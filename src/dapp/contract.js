import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

let config;

export default class Contract {
    constructor(network, callback) {

        config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight, departure, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: departure
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    registerAirline(fromAirline, airline, callback) {
      let self = this;
      self.flightSuretyApp.methods
        .registerAirline(airline)
        .send({ from: fromAirline, gas: config.gas}, (error, result) => {
          callback(error, result);
        });
    }

    fundAirline(airline, funds, callback) {
      let self = this;
      self.flightSuretyApp.methods
        .fundAirline()
        .send({ from: airline, value: this.web3.utils.toWei(funds, "ether"), gas: config.gas}, (error, result) => {
          callback(error, result);
        });
    }

    async getFlightKeys() {
      let self = this;
      return await self.flightSuretyApp.methods.getFlightKeys().call({from: this.owner});
    }

    async buyInsurance(request) {
      let self = this;
      console.log(request);
      let caller = request.from;
      let paymentAmount = this.web3.utils.toWei(request.amount.toString(), "ether");

      let flight  = await self.flightSuretyApp.methods.getFlight(request.flight.toString()).call({from: caller, gas: config.gas});
      let airline = flight.airline;
      let flightNumber = flight.flight;
      let departureTime = flight.departureTime;

      await self.flightSuretyApp.methods.buyInsurance(airline, flightNumber, departureTime).send({from: caller, value: paymentAmount, gas: config.gas});
    }

    async getPassengerCredit(request) {
      let self = this;

      let caller = request.from;
      let flight  = await self.flightSuretyApp.methods.getFlight(request.flight.toString()).call({from: caller, gas: config.gas});
      let airline = flight.airline;
      let flightNumber = flight.flight;
      let departureTime = flight.departureTime;

      return await self.flightSuretyApp.methods.getPassengerCredit(request.from, airline, flightNumber, departureTime).call({from: caller, gas: config.gas});
    }

    async payPassengerCredit(request) {
      let self = this;

      let caller = request.from;
      let flight  = await self.flightSuretyApp.methods.getFlight(request.flight.toString()).call({from: caller, gas: config.gas});
      let airline = flight.airline;
      let flightNumber = flight.flight;
      let departureTime = flight.departureTime;

      return await self.flightSuretyApp.methods.withdrawPassengerCredit(airline, flightNumber, departureTime).call({from: caller, gas: config.gas});
    }
}