pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20; //when the oracle reports this code, we will credit the passenger
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    FlightSuretyData flightSuretyData;

    // after this threshold is reached the airlines would need multi-party consensus to add new airlines
    uint8 private constant THRESHOLD_AIRLINES = 4;
    uint256 public constant AIRLINE_SEED_FUNDING = 10 ether;
    uint256 private constant MAX_INSURANCE_CAP = 1 ether; // max amount per user when buying an insurance

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event RegisteredAirline(address airlineAddress, uint256 totalAirlines);
    event AirlineVoted(address airlineAddress, uint256 votes);
    event AirlineFunded(address airlineAddress, uint256 funds);
    event FlightRegistered(string flightNumber, address airlineAddress, uint256 departureTime, bytes32 flightKey);
    event FlightInsurancePurchased(address passengerAddress, uint256 amount);
    event FlightInsuranceWithdraw(address passengerAddress, uint256 amount);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(true, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifier that requires the caller to be a registered airline
     */
    modifier requireRegisteredAirline() {
        require(flightSuretyData.isAirlineRegistered(msg.sender), "Caller is not a registered airline");
        _;
    }

    /**
     * @dev Modifier that requires the caller to be a funded airline
     */
    modifier requireFundedAirline() {
        require(flightSuretyData.isAirlineFunded(msg.sender), "Caller is not a funded airline");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                    address _dataContract,
                                    address _airline,
                                    string _airlineName
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(_dataContract);
        flightSuretyData.registerFirstAirline(_airline, _airlineName);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            pure 
                            returns(bool) 
    {
        return true;  // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    * This method will be used by airlines to add funds to the insurance pool
    *
    */
    function fundAirline()
    public
    payable
    requireIsOperational
    requireRegisteredAirline
    {
        require(msg.value >= AIRLINE_SEED_FUNDING, "Minimum amount to fund an airline is 10 ether");
        flightSuretyData.fundAirline(msg.sender, msg.value);

        address(flightSuretyData).transfer(msg.value);

        emit AirlineFunded(msg.sender, msg.value);
    }

   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline
    (
        address _airlineAddress,
        string _name
    )
    external
    requireIsOperational
    requireFundedAirline
    returns(bool success, uint256 votes)
    {
        require(!flightSuretyData.isAirlineRegistered(_airlineAddress), "Airline is registered already");

        bool registered = false;
        uint256 numberOfVotes = 0;

        uint256 airlinesCount = flightSuretyData.getAirlinesCount();
        if (airlinesCount < THRESHOLD_AIRLINES ) {
            flightSuretyData.registerAirline(_airlineAddress, _name);
            registered = true;
            emit RegisteredAirline(_airlineAddress, flightSuretyData.getAirlinesCount());

        } else {
            require(flightSuretyData.voted(_airlineAddress, msg.sender) == false, "Caller has already voted");

            flightSuretyData.registerVote(_airlineAddress, msg.sender);

            uint256 requiredVotes = airlinesCount.div(2);
            if (airlinesCount % 2 != 0) {
                requiredVotes = requiredVotes.add(1);
            }

            numberOfVotes = flightSuretyData.airlineVotesCount(_airlineAddress);
            if (numberOfVotes == requiredVotes) {
                flightSuretyData.registerAirline(_airlineAddress, _name);
                registered = true;
                emit RegisteredAirline(_airlineAddress, flightSuretyData.getAirlinesCount());
            } else {
                emit AirlineVoted(_airlineAddress, numberOfVotes);
            }
        }

        return (registered, numberOfVotes);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight (string _flightNumber, uint256 _departureTime)
    public
    requireIsOperational
    requireFundedAirline
    {
        // Make sure flight is not registered
        require(!flightSuretyData.isFlightRegistered(msg.sender, _flightNumber, _departureTime), "Flight is already registered");
        bytes32 flightKey = flightSuretyData.registerFlight(msg.sender, _flightNumber, _departureTime, STATUS_CODE_UNKNOWN);

        emit FlightRegistered(_flightNumber, msg.sender, _departureTime, flightKey);
    }

    function getFlightKeys()
    public
    view
    requireIsOperational
    returns (bytes32[] memory)
    {
        return flightSuretyData.getFlightKeys();
    }

    /**
    * Buy an insurance
    *
    */
    function buyInsurance(address _airlineAddress, string _flightNumber, uint256 _departureTime)
    public
    payable
    requireIsOperational
    {
        require(msg.value > 0 && msg.value <= MAX_INSURANCE_CAP, "Passenger can buy insurance for a maximum of 1 ether");
        flightSuretyData.buyInsurance(
            _airlineAddress,
            _flightNumber,
            _departureTime,
            msg.sender,
            msg.value
        );

        address(flightSuretyData).transfer(msg.value);

        emit FlightInsurancePurchased(msg.sender, msg.value);
    }

    function getFlight(bytes32 _flightKey)
    public
    view
    requireIsOperational
    returns (
        address airline,
        string memory flight,
        uint256 departureTime,
        uint8 statusCode
    )
    {
        return flightSuretyData.getFlight(_flightKey);
    }

    /**
    * @dev Move funds from the insurance to the user balance (in the contract)
    *
    */
    function getPassengerCredit(address _passenger, address _airline, string _flight, uint256 _departureTime)
    public
    view
    requireIsOperational
    returns (uint256)
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _departureTime);

        return flightSuretyData.getPassengerCredit(_passenger, flightKey);
    }

    /**
    * @dev Move the user balance to their account (out of the contract)
    *
    */
    function withdrawPassengerCredit(address _airline, string _flight, uint256 _departureTime)
    public
    requireIsOperational
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _departureTime);
        uint256 amount = flightSuretyData.pay(flightKey, msg.sender);

        emit FlightInsuranceWithdraw(msg.sender, amount);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus
                                (
                                    address airline,
                                    string memory flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                public
                                requireIsOperational
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            flightSuretyData.creditInsurees(flightKey);
        }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp                            
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns a random integer from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
