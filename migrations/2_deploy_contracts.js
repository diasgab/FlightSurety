const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = async function(deployer, network, accounts) {

    let firstAirline = accounts[1];
    await deployer.deploy(FlightSuretyData)
    .then(() => {
        return deployer.deploy(FlightSuretyApp, FlightSuretyData.address, firstAirline)
                .then(() => {
                    let config = {
                        localhost: {
                            url: 'http://localhost:7545',
                            dataAddress: FlightSuretyData.address,
                            appAddress: FlightSuretyApp.address
                        }
                    }
                    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                });
    });

    let flightSuretyDataInstance = await FlightSuretyData.deployed();
    let flightSuretyAppInstance = await FlightSuretyApp.deployed();

    console.log(`Adding authorized caller ${flightSuretyAppInstance.address}`);

    // let's authorize flightSuretyApp in flightSuretyData
    await flightSuretyDataInstance.authorizeCaller(flightSuretyAppInstance.address);
}