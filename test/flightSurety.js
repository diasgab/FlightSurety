
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

const getErrorObj = (obj = {}) => {
  const txHash = Object.keys(obj)[0];
  return obj[txHash];
};

contract('Flight Surety Tests', async (accounts) => {

  var config;
  beforeEach('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  describe("fundAirline()", () => {

    it('should allow a registered airline to add funds to the insurance pool', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});

      let result = await config.flightSuretyData.isAirlineFunded(config.firstAirline, {from: config.firstAirline});

      assert.equal(result, true, `Airline ${config.firstAirline} is not funded`);
    });

    it('should prevent an airline to send less funds than the required', async () => {
      try {
        await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('1', 'ether')});
      } catch (e) {
        const {error, reason} = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, "Minimum amount to fund an airline is 10 ether");
      }
    });

    it('should increment the insurance funds pool when funding airlines', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});
      let result = await config.flightSuretyData.getTotalFunds.call();

      assert.equal(result, web3.utils.toWei('10', 'ether'), "The total funds should be 10 ether");
    });

    it('should keep consistency between the contract balance and the added funds', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.registerAirline(accounts[3], {from: config.firstAirline});
      await config.flightSuretyApp.fundAirline({from: accounts[3], value: web3.utils.toWei('10', 'ether')});

      let result = await web3.eth.getBalance(config.flightSuretyData.address);

      assert.equal(result, web3.utils.toWei('20', 'ether'), "The total funds should be 20 ether");
    });

  });

  describe("registerAirline()", () => {

    it('should prevent an airline to register a new airline if the former is not funded', async () => {

      // ARRANGE
      let newAirline = accounts[2];

      // ACT
      try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
      } catch (e) {

      }
      let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline);

      // ASSERT
      assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

    });

    it('should allow the first funded airline to add up to 3 more airlines without requiring consensus', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});

      await config.flightSuretyApp.registerAirline(accounts[3], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[4], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[5], {from: config.firstAirline});

      // this last one should not be added
      let newAirline = accounts[6];
      await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});

      let result = await config.flightSuretyData.getAirlinesCount.call();

      // ASSERT
      assert.equal(result, 4, "There are more registered airlines than expected");
    });

    it('should allow a funded airline to vote for a new airline to be included', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.registerAirline(accounts[3], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[4], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[5], {from: config.firstAirline});

      // this last one should not be added but should count as a voted one
      let newAirline = accounts[6];
      await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});

      let result = await config.flightSuretyData.airlineVotesCount.call(newAirline);

      assert.equal(result, 1, `Airline ${newAirline} should have 1 vote`);
    });

    it("should prevent adding a new airline if it doesn't reach to the minimum consensus", async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.registerAirline(accounts[3], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[4], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[5], {from: config.firstAirline});

      await config.flightSuretyApp.fundAirline({from: accounts[3], value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.fundAirline({from: accounts[4], value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.fundAirline({from: accounts[5], value: web3.utils.toWei('10', 'ether')});

      // having 1 vote shouldn't be enough
      let newAirline = accounts[6];
      await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});

      let votesCount = await config.flightSuretyData.airlineVotesCount.call(newAirline);
      let result = await config.flightSuretyData.getAirlinesCount.call();
      
      assert.equal(votesCount, 1, `There should be only 2 votes`);
      assert.equal(result, 4, `There should be only 4 airlines`);
    });

    it('should allow an airline to be included after reaching the consensus', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.registerAirline(accounts[3], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[4], {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(accounts[5], {from: config.firstAirline});

      await config.flightSuretyApp.fundAirline({from: accounts[3], value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.fundAirline({from: accounts[4], value: web3.utils.toWei('10', 'ether')});
      await config.flightSuretyApp.fundAirline({from: accounts[5], value: web3.utils.toWei('10', 'ether')});

      // having 2 votes should be enough because we only need half of the airlines to agree
      let newAirline = accounts[6];
      await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
      await config.flightSuretyApp.registerAirline(newAirline, {from: accounts[3]});

      let result = await config.flightSuretyData.getAirlinesCount.call();

      assert.equal(result, 5, `There should be 5 airlines available! The consensus failed`);
    });
  });

  describe("registerFlight()", () => {

    it('should allow a funded airline to register a flight', async () => {

      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});

      let defaultDate = new Date();
      // current day plus 8 days
      defaultDate.setDate((defaultDate.getDate() + 8));

      let flightNumber = 'GD001';
      let departureTime = defaultDate.valueOf();

      // ACT
      try {
        await config.flightSuretyApp.registerFlight(flightNumber, departureTime, {from: config.firstAirline});
      } catch (e) {

      }
      let result = await config.flightSuretyData.isFlightRegistered.call(config.firstAirline, flightNumber, departureTime);

      // ASSERT
      assert.equal(result, true, "Flight should be registered");
    });

    it('should prevent a registered airline (not funded) to register a flight', async () => {
      let defaultDate = new Date();
      // current day plus 8 days
      defaultDate.setDate((defaultDate.getDate() + 8));

      let flightNumber = 'GD001';
      let departureTime = defaultDate.valueOf();

      // ACT
      try {
        await config.flightSuretyApp.registerFlight(flightNumber, departureTime, {from: config.firstAirline});
      } catch (e) {

      }
      let result = await config.flightSuretyData.isFlightRegistered.call(config.firstAirline, flightNumber, departureTime);

      // ASSERT
      assert.equal(result, false, "Flight should NOT be registered");
    });
  });

  describe("buyInsurance()", () => {

    it('should allow a passenger to buy a flight insurance', async () => {

      // fund airline
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});

      // register flight
      let defaultDate = new Date();
      defaultDate.setDate((defaultDate.getDate() + 8));
      let flightNumber = 'GD001';
      let departureTime = defaultDate.valueOf();
      await config.flightSuretyApp.registerFlight(flightNumber, departureTime, {from: config.firstAirline});

      // passenger (will be any address with some ether)
      let passenger = accounts[6];

      // ACT
      let success = false;
      try {
        await config.flightSuretyApp.buyInsurance(config.firstAirline, flightNumber, departureTime, {from: passenger, value: web3.utils.toWei('1', 'ether')});
        success = true;
      } catch (e) {

      }

      // ASSERT
      assert.equal(success, true, "Error when buying insurance");
    });

    it('should prevent a passenger to buy a flight insurance with more than 1 ether', async () => {

      // fund airline
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});

      // register flight
      let defaultDate = new Date();
      defaultDate.setDate((defaultDate.getDate() + 8));
      let flightNumber = 'GD001';
      let departureTime = defaultDate.valueOf();
      await config.flightSuretyApp.registerFlight(flightNumber, departureTime, {from: config.firstAirline});

      // passenger (will be any address with some ether)
      let passenger = accounts[6];

      // ACT
      let success = false;
      try {
        await config.flightSuretyApp.buyInsurance(config.firstAirline, flightNumber, departureTime, {from: passenger, value: web3.utils.toWei('1.1', 'ether')});
        success = true;
      } catch (e) {

      }

      // ASSERT
      assert.equal(success, false, "Error when preventing to buy insurance");
    });

    it('should keep consistency between the contract balance and the added funds', async () => {
      await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei('10', 'ether')});

      // buy insurance
      let defaultDate = new Date();
      defaultDate.setDate((defaultDate.getDate() + 8));
      let flightNumber = 'GD001';
      let departureTime = defaultDate.valueOf();
      await config.flightSuretyApp.registerFlight(flightNumber, departureTime, {from: config.firstAirline});

      // passenger (will be any address with some ether)
      let passenger = accounts[6];
      await config.flightSuretyApp.buyInsurance(config.firstAirline, flightNumber, departureTime, {from: passenger, value: web3.utils.toWei('1', 'ether')});

      let result = await web3.eth.getBalance(config.flightSuretyData.address);

      assert.equal(result, web3.utils.toWei('11', 'ether'), "The total funds should be 11 ether");
    });
  });
});
