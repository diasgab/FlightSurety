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
        bool isRegistered;
        bool isFunded;
    }

    mapping(address => Airline) airlines;
    uint256 private countAirlines = 0;
    mapping(address => address[]) private airlineVotes;

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
    function authorizeCaller(address _callerAddress) requireContractOwner public returns (bool) {
        authorizedCallers[_callerAddress] = true;

        return true;
    }

    /**
    * Check if an airline is registered
    * @param _airlineAddress the airline address to check
    */
    function isAirlineRegistered(address _airlineAddress) public view returns(bool) {
        return airlines[_airlineAddress].isRegistered;
    }

    /**
    * Returns the amount of registered airlines
    */
    function getAirlinesCount() public view returns(uint256) {
        return countAirlines;
    }

    /**
    * Checks if an airline has already voted for another airline to be included
    * @param _airlineAddress the address to be included
    * @param _voterAddress the voter
    */
    function voted(address _airlineAddress, address _voterAddress) public view returns (bool) {
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
    public
    requireIsOperational
    requireAuthorizedCaller {
        airlineVotes[_airlineAddress].push(_voterAddress);
    }

    /**
    * Fetch the amount of votes an airline has received
    * @param _airlineAddress the address to get the votes amount
    */
    function airlineVotesCount(address _airlineAddress) public view returns (uint256) {
        return airlineVotes[_airlineAddress].length;
    }

    function isAirlineFunded(address _airlineAddress) public view returns (bool) {
        return airlines[_airlineAddress].isFunded;
    }

    function getTotalFunds() public view returns (uint256) {
        return totalFunds;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    *
    */
    function registerFirstAirline(address _airlineAddress) public requireIsOperational {
        require(countAirlines == 0, "Not the first airline");
        airlines[_airlineAddress] = Airline({
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
    public
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
        address _airlineAddress
    )
    public
    requireIsOperational
    requireAuthorizedCaller
    {
        airlines[_airlineAddress] = Airline({
            isRegistered: true,
            isFunded: false
        });

        countAirlines = countAirlines.add(1);
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
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
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() public payable requireAuthorizedCaller {}

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }


}

