
module.exports = {
  networks: {
    development: {
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