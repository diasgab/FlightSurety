const dotenv = require("dotenv");
dotenv.config();

var HDWalletProvider = require("truffle-hdwallet-provider");
const mnemonic = process.env.MNEMONIC;

module.exports = {
  networks: {
    development: {
      //provider: function() {
      //  return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
      //},
      host: "127.0.0.1",
      port: 7545,
      network_id: '5777',
      gas: 6700000,
      gasPrice: 10000000000
    }
  },
  compilers: {
    solc: {
      version: "^0.4.25"
    }
  }
};