# Local EVM Blockchain Setup

## 1. Prerequisites
- Node.js $\ge 18$
- Hardhat 2.22+

## 2. Starting the Local Hardhat Node
From the `blockchain/` directory:
```powershell
cd blockchain
npx hardhat node
```
This starts an Ethereum-compatible JSON-RPC node on `http://127.0.0.1:8545` with:
- **Chain ID**: `31337` (Hex: `0x7a69`)
- **Default Accounts**: 20 funded test accounts with 10,000 ETH each.
- **Deployer Account (#0)**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

## 3. Compiling Smart Contracts
```powershell
cd blockchain
npx hardhat compile
```

## 4. Running Contract Tests
```powershell
cd blockchain
npx hardhat test
```

## 5. Deploying to Local Network
```powershell
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```
Deploys `PropertyRegistry`, `OwnershipRegistry`, and `TransactionManager`, and writes deployment artifacts to `blockchain/deployments/localhost.json`.

