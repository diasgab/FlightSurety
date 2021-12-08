
# Prerequisites
* Truffle v5.3.7 (core: 5.3.7)
* Solidity - ^0.4.25 (solc-js)
* Node v12.16.1
* Web3.js v1.3.6

# Project setup

* `nvm install v12.16.1`
* `nvm use v12.16.1`
* `npm install`
* create a workspace in ganache-ui with 30 accounts (and 1000 ETH balance) in port 7545
* Make sure to use the right truffle version. You can run `npx truffle version` from the project root dir

# Compile the contracts
truffle migrate --reset
npm run dapp
npm run server

# Running tests
truffle test ./test/flightSurety.js







------------------------------------------------

# FlightSurety

FlightSurety is a sample application project for Udacity's Blockchain course.

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), dApp scaffolding (using HTML, CSS and JS) and server app scaffolding.

To install, download or clone the repo, then:

`npm install`
`truffle compile`

## Develop Client

To run truffle tests:

`truffle test ./test/flightSurety.js`
`truffle test ./test/oracles.js`

To use the dapp:

`truffle migrate`
`npm run dapp`

To view dapp:

`http://localhost:8000`

## Develop Server

`npm run server`
`truffle test ./test/oracles.js`

## Deploy

To build dapp for prod:
`npm run dapp:prod`

Deploy the contents of the ./dapp folder


## Resources

* [How does Ethereum work anyway?](https://medium.com/@preethikasireddy/how-does-ethereum-work-anyway-22d1df506369)
* [BIP39 Mnemonic Generator](https://iancoleman.io/bip39/)
* [Truffle Framework](http://truffleframework.com/)
* [Ganache Local Blockchain](http://truffleframework.com/ganache/)
* [Remix Solidity IDE](https://remix.ethereum.org/)
* [Solidity Language Reference](http://solidity.readthedocs.io/en/v0.4.24/)
* [Ethereum Blockchain Explorer](https://etherscan.io/)
* [Web3Js Reference](https://github.com/ethereum/wiki/wiki/JavaScript-API)