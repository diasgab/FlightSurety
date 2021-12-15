import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let firstAirline = config.firstAirline;

let oracleAccounts;
let oracles = [];
let flights = ["ND001", "ND002", "ND003", "ND004", "ND005"];

(async() => {
  let accounts = await web3.eth.getAccounts();
  oracleAccounts = accounts.splice(10,29);

  // fund the first airline, so we are able to add flights
  await flightSuretyApp.methods.fundAirline()
    .send({from: firstAirline, value: web3.utils.toWei('10', "ether")})
    .then(result => {
      console.log(`Airline ${firstAirline} funded`);
    })
    .catch(error => {
      console.log(`Error funding airline ${firstAirline}: `, error);
    });

  let defaultDate = new Date();
  // current day plus 8 days
  defaultDate.setDate((defaultDate.getDate() + 8));

  // register flights
  let newFlight;
  for (let c = 0; c < flights.length; c++) {

    newFlight = {
      flightNumber: flights[c],
      timestamp: defaultDate.valueOf(),
      airline: firstAirline
    }

    await flightSuretyApp.methods.registerFlight(newFlight.flightNumber, newFlight.timestamp).send(
      {
        from: newFlight.airline,
        gas: 4712388,
        gasPrice: 100000000000
      }
    ).then(result => {
      console.log(`Flight ${newFlight.flightNumber} registered`);
    })
    .catch(error => {
      console.log(`Error registering flight ${newFlight.flightNumber}`, error);
    });
  }

  // fee for registering oracle
  let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();

  // register oracles
  for (let i = 0; i < oracleAccounts.length; i++) {
    try {
      await flightSuretyApp.methods.registerOracle().send({
        from: oracleAccounts[i],
        value: fee,
        gas: 4712388,
        gasPrice: 100000000000
      });

      let index = await flightSuretyApp.methods.getMyIndexes().call({from: oracleAccounts[i]});
      oracles.push({
        address : oracleAccounts[i],
        indexes : index
      });
      console.log(`Oracle #${(i + 1)} ${oracleAccounts[i]} registered: ${index}`);
    } catch(error) {
      console.log(error);
      console.log(`Oracle ${oracleAccounts[i]} was not registered`);
    }
  }
})();

console.log("Registering Oracles and Flights...");

flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


