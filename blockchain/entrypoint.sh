#!/bin/sh
set -e

echo "Starting Hardhat EVM Node on 0.0.0.0:8545..."
npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

echo "Waiting for Hardhat node to accept connections..."
node -e '
const http = require("http");
function ping() {
  const req = http.request({ host: "127.0.0.1", port: 8545, method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
    process.exit(0);
  });
  req.on("error", () => {
    setTimeout(ping, 500);
  });
  req.write(JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }));
  req.end();
}
ping();
'

echo "Hardhat node is live! Deploying smart contracts..."
npx hardhat run scripts/deploy.js --network localhost

echo "Contracts successfully deployed! Keeping node alive..."
wait $NODE_PID

