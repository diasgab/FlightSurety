pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                      // Account used to deploy contract
    bool private operational = true;                    // Blocks all state changes throughout the contract if false
    mapping(address => bool) private authorizedCallers; // this refers to the smart contract app who is able to use this contract

    struct Airline {
        string name;
        bool isRegistered;
        bool isFunded;
    }

    mapping(address => Airline) airlines;
    uint256 private countAirlines = 0;
    mapping(address => address[]) private airlineVotes;

    struct Flight {
        string flightCode;
        bool isRegistered;
        uint8 statusCode;
        uint256 departureTime;
        address airline;
    }

    mapping(bytes32 => Flight) private flights;
    bytes32[] private flightKeys; // Keys of registered flights

    struct FlightInsurance {
        mapping(address => uint256) purchasedAmount; // per passenger
        mapping(address => uint256) refundedAmount;  //per passenger
        address[] passengers;                        // All insured passengers in a flight
        bool isFullyRefunded;
    }

    mapping(bytes32 => FlightInsurance) private insurances; // Insurance per flight

    // the funds will increase by airline contributions and decrease when paying to insurees
    uint256 private totalFunds = 0 ether;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                )
                                public
    {
        contractOwner = msg.sender;
    }

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
        require(operational, "Contract is currently not operational");
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
    * Checks that the request came from an authorized caller
    */
    modifier requireAuthorizedCaller() {
        require(authorizedCallers[msg.sender] == true, "Caller is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational()
                            public
                            view
                            returns(bool)
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus
                            (
                                bool mode
                            )
                            external
                            requireContractOwner
    {
        operational = mode;
    }

    /**
    * This method would be needed to allow access only from the FlightSuretyApp contract
    * @param _callerAddress the address to be added as authorized
    */
    function authorizeCaller(address _callerAddress) requireContractOwner external returns (bool) {
        authorizedCallers[_callerAddress] = true;

        return true;
    }

    /**
    * Check if an airline is registered
    * @param _airlineAddress the airline address to check
    */
    function isAirlineRegistered(address _airlineAddress) external requireIsOperational view returns(bool) {
        return airlines[_airlineAddress].isRegistered;
    }

    /**
    * Returns the amount of registered airlines
    */
    function getAirlinesCount() external requireIsOperational view returns(uint256) {
        return countAirlines;
    }

    /**
    * Checks if an airline has already voted for another airline to be included
    * @param _airlineAddress the address to be included
    * @param _voterAddress the voter
    */
    function voted(address _airlineAddress, address _voterAddress)
    public requireIsOperational view returns (bool) {
        address[] memory votes = airlineVotes[_airlineAddress];
        for (uint i = 0; i < votes.length; i++) {
            if (votes[i] == _voterAddress) {
                return true;
            }
        }
        return false;
    }

    /**
    * Register an airline vote
    * @param _airlineAddress the address to be included
    * @param _voterAddress the voter
    */
    function registerVote(address _airlineAddress, address _voterAddress)
    external
    requireIsOperational
    requireAuthorizedCaller {
        airlineVotes[_airlineAddress].push(_voterAddress);
    }

    /**
    * Fetch the amount of votes an airline has received
    * @param _airlineAddress the address to get the votes amount
    */
    function airlineVotesCount(address _airlineAddress) external requireIsOperational view returns (uint256) {
        return airlineVotes[_airlineAddress].length;
    }

    function isAirlineFunded(address _airlineAddress) external requireIsOperational view returns (bool) {
        return airlines[_airlineAddress].isFunded;
    }

    function getTotalFunds() external requireIsOperational view returns (uint256) {
        return totalFunds;
    }

    function isFlightRegistered(address _airline, string _flightCode, uint256 _timestamp)
    external requireIsOperational view returns (bool) {
        bytes32 key = getFlightKey(_airline, _flightCode, _timestamp);
        return flights[key].isRegistered;
    }

    function getPassengerCredit(address _passenger, bytes32 flightKey)
    external requireIsOperational view returns (uint256) {
        require(flights[flightKey].isRegistered, "Flight does not exist");

        return insurances[flightKey].refundedAmount[_passenger];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    *
    */
    function registerFirstAirline(address _airlineAddress, string _name) external requireIsOperational {
        require(countAirlines == 0, "Not the first airline");
        airlines[_airlineAddress] = Airline({
            name: _name,
            isRegistered: true,
            isFunded: false
        });

        countAirlines = countAirlines.add(1);
    }

    /**
     * @dev Initial funding for the insurance (made by airline upon registration). Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fundAirline
    (
        address _airlineAddress,
        uint256 _fundAmount
    )
    external
    payable
    requireIsOperational
    requireAuthorizedCaller
    {
        airlines[_airlineAddress].isFunded = true;
        totalFunds = totalFunds.add(_fundAmount);
    }

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline
    (
        address _airlineAddress,
        string _name
    )
    external
    requireIsOperational
    requireAuthorizedCaller
    {
        airlines[_airlineAddress] = Airline({
            name: _name,
            isRegistered: true,
            isFunded: false
        });

        countAirlines = countAirlines.add(1);
    }

    /**
    * Registers a new flight
    */
    function registerFlight(address _airline, string _flight, uint256 _departureTime, uint8 _status)
    external
    requireIsOperational
    requireAuthorizedCaller
    returns (bytes32)
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _departureTime);
        flights[flightKey] = Flight({
            flightCode: _flight,
            isRegistered: true,
            statusCode: _status,
            departureTime: _departureTime,
            airline: _airline
        });

        flightKeys.push(flightKey);

        return flightKey;
    }

    function buyInsurance(address _airline, string _flight, uint256 _departureTime, address _passenger, uint256 _amount)
    external
    payable
    requireIsOperational
    requireAuthorizedCaller
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _departureTime);
        require(flights[flightKey].isRegistered, "Flight does not exist");
        insurances[flightKey].purchasedAmount[_passenger] = _amount;
        insurances[flightKey].passengers.push(_passenger);
        insurances[flightKey].isFullyRefunded = false;

        totalFunds = totalFunds.add(_amount);
    }

    function getFlightKeys()
    external
    view
    requireIsOperational
    requireAuthorizedCaller
    returns (bytes32[] memory)
    {
        return flightKeys;
    }

    function getFlight(bytes32 _flightKey)
    external
    view
    requireIsOperational
    requireAuthorizedCaller
    returns (
        address airline,
        string memory flight,
        uint256 departureTime,
        uint8 statusCode
    )
    {
        airline = flights[_flightKey].airline;
        flight = flights[_flightKey].flightCode;
        departureTime = flights[_flightKey].departureTime;
        statusCode = flights[_flightKey].statusCode;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    bytes32 _flightKey
                                )
                                external
                                requireIsOperational
                                requireAuthorizedCaller
    {
        require(flights[_flightKey].isRegistered, "Flight does not exist");
        require(insurances[_flightKey].isFullyRefunded == false, "Already refunded");
        insurances[_flightKey].isFullyRefunded = true;

        address passenger;
        uint256 amountToRefund;
        for(uint i = 0; i < insurances[_flightKey].passengers.length; i++) {
            passenger = insurances[_flightKey].passengers[i];

            // pay to the passenger 1.5x the amount they paid for the insurance
            amountToRefund = insurances[_flightKey].purchasedAmount[passenger];
            amountToRefund = amountToRefund.mul(3).div(2);
            if (amountToRefund > 0) {
                require(amountToRefund <= totalFunds, "Not enough funds to credit insurees");
                insurances[_flightKey].refundedAmount[passenger] = amountToRefund;
                insurances[_flightKey].purchasedAmount[passenger] = 0;
                totalFunds -= amountToRefund;
            }
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                                bytes32 _flightKey,
                                address _passenger
                            )
                            external
                            requireIsOperational
                            requireAuthorizedCaller
                            returns(uint256)
    {
        require(flights[_flightKey].isRegistered, "Flight does not exist");
        require(insurances[_flightKey].refundedAmount[_passenger] > 0, "Nothing to withdraw");
        require(insurances[_flightKey].refundedAmount[_passenger] < totalFunds, "Not enough funds in contract to withdraw");

        address(_passenger).transfer(insurances[_flightKey].refundedAmount[_passenger]);

        return insurances[_flightKey].refundedAmount[_passenger];
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable {}
}

