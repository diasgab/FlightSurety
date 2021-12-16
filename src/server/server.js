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

  try {
    // fund the first airline, so we are able to add flights
    await flightSuretyApp.methods.fundAirline()
      .send({from: firstAirline, value: web3.utils.toWei('10', "ether")})
      .then(result => {
        console.log(`Airline ${firstAirline} funded`);
      })
      .catch(error => {
        console.log(`Error funding airline ${firstAirline}: `, error);
      });
  } catch (e) {
    console.log("Error: ", e);
  }

  let defaultDate = new Date();
  // current day plus 8 days
  defaultDate.setDate((defaultDate.getDate() + 8));

  // register flights
  let newFlight;
  for (let c = 0; c < flights.length; c++) {

    newFlight = {
      flightNumber: flights[c],
      timestamp: Math.floor(defaultDate / 1000),
      airline: firstAirline
    }

    try {
      await flightSuretyApp.methods.registerFlight(newFlight.flightNumber, newFlight.timestamp).send(
        {
          from: newFlight.airline,
          gas: 4712388,
          gasPrice: 100000000000
        }
      ).then(result => {
        console.log(`Flight ${newFlight.flightNumber} registered with timestamp ${newFlight.timestamp}`);
      })
        .catch(error => {
          console.log(`Error registering flight ${newFlight.flightNumber}`, error);
        });
    } catch (e) {
      console.log("Error: ", e);
    }
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

console.log("Registering Oracles...");

// Watch contract events
let states = {
    0: 'unknown',
    10: 'on time',
    20: 'late due to airline',
    30: 'late due to weather',
    40: 'late due to technical reason',
    50: 'late due to other reason'
};

flightSuretyApp.events.OracleReport({
  fromBlock: "latest"
}, async function (error, event) {
  if (error) {
    console.log(error)
  }

  let airline = event.returnValues.airline;
  let flight = event.returnValues.flight;
  let timestamp = event.returnValues.timestamp;
  let status = event.returnValues.status;

  //console.log(`OracleReport: airline ${airline}, flight ${flight}, date ${timestamp}, status ${states[status]}`)
});

flightSuretyApp.events.FlightStatusInfo({
  fromBlock: "latest"
}, async function (error, event) {
  if (error) {
    console.log(error)
  }

  let airline = event.returnValues.airline;
  let flight = event.returnValues.flight;
  let timestamp = event.returnValues.timestamp;
  let status = event.returnValues.status;

  //console.log(`FlightStatusInfo: airline ${airline}, flight ${flight}, date ${timestamp}, status ${states[status]}`)
});

flightSuretyApp.events.OracleRequest({
    fromBlock: "latest"
  }, async function (error, event) {
    if (error) {
      console.log(error)
      return;
    }

    let airline = event.returnValues.airline;
    let flight = event.returnValues.flight;
    let timestamp = event.returnValues.timestamp;

    console.log(`Airline ${airline}, flight ${flight}, timestamp ${timestamp}`)

    let selectedCode;
    for(let a=1; a<oracleAccounts.length; a++) {

      // increment the chances to get the delay status by airline for testing purposes
      if (a % 2 == 0) {
        selectedCode = 20;
      } else {
        // random number out of [10, 20, 30, 40, 50]
        selectedCode = (Math.floor(Math.random() * 5) + 1) * 10;
      }

      // Get oracle information
      let oracleIndexes = await flightSuretyApp.methods.getMyIndexes().call({from: oracleAccounts[a]});
      for(let idx=0;idx<3;idx++) {

        try {
          flightSuretyApp.methods.submitOracleResponse(
            oracleIndexes[idx], airline, flight, timestamp, selectedCode
          ).send({
            from: oracleAccounts[a],
            gas: config.gas
          }).then(result => {
            console.log(`Oracle: ${oracleIndexes[idx]} responded from flight ${flight} with status ${selectedCode} ${states[selectedCode]}`);
          }).catch(err => {
            console.log(err.message);
          });
        } catch(e) {
          console.log("Error: " + e);
        }
      }
    }
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


