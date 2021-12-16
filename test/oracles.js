var Test = require('../config/testConfig.js');
const assert = require("assert");
//var BigNumber = require('bignumber.js');

// Watch contract events
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

let departureTime = Math.floor(Date.now() / 1000);

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 20;
  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
  });

  it('can register oracles', async () => {

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    let success = false;
    try {
      // ACT
      for (let a = 1; a <= TEST_ORACLES_COUNT; a++) {
        await config.flightSuretyApp.registerOracle({from: accounts[a], value: fee});
        let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
        console.log(`Oracle #${a} registered: ${result[0]}, ${result[1]}, ${result[2]}`);
      }

      success = true;
    } catch (e) {

    }

    assert.ok(success, 'Failed to register oracles');
  });

  it('can request flight status', async () => {

    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = departureTime;

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });

        }
        catch(e) {
          // Enable this when debugging
           console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }

      }
    }
  });

  it('will credit 1.5X the amount the passenger paid if flight is delayed due to airline fault', async () => {

    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = departureTime;

    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);

    // fund airline and register flight
    await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', "ether")})
    await config.flightSuretyApp.registerFlight(flight, timestamp,
      {
        from: config.firstAirline,
        gas: 4712388,
        gasPrice: 100000000000
      }
    );

    // let a passenger buy an insurance
    let passenger = accounts[6];
    await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, timestamp, {from: passenger, value: web3.utils.toWei('1', 'ether')});

    // ACT

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT

    // Let's try to force a response from the oracles with late airline status
    let successResponses = 0;
    let a=1;
    do {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, { from: accounts[a] });
          console.log('\nMatch', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
          successResponses++;
        }
        catch(e) {
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
      }

      a++;

      // this will make sure we will always reach the 3 min required responses. This is the only way to credit the insurees
      if (a == TEST_ORACLES_COUNT && successResponses != 3) {
        a = 1;
      }
    } while ( a < TEST_ORACLES_COUNT && successResponses <= 3);

    // check the passenger credit
    let credit = await config.flightSuretyApp.getPassengerCredit(passenger, config.firstAirline, flight, timestamp);
    assert.equal(credit, web3.utils.toWei('1.5', 'ether'), "The credit amount is not as expected. Please run the tests again.");

  });

  it('Passenger can withdraw any funds owed to them as a result of receiving credit for insurance payout\n', async () => {

    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = departureTime;

    // request a withdrawal
    let passenger = accounts[6];
    await config.flightSuretyApp.withdrawPassengerCredit(config.firstAirline, flight, timestamp, {from: passenger});

    let result = await web3.eth.getBalance(config.flightSuretyData.address);
    assert.equal(result, web3.utils.toWei('9.5', 'ether'), "The total funds should be 9.5 ether. Please run the tests again.");

  });

});
