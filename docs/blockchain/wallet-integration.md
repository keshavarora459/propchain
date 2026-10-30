# MetaMask & Web3 Wallet Integration

## 1. Overview
PropChain integrates MetaMask using `ethers.js` (v6) with a cryptographic challenge-response authentication scheme (EIP-191). This ensures that only users who mathematically prove control of an Ethereum private key can associate that wallet with their user account.

## 2. Cryptographic Linking Flow
1. **Challenge Request**:
   - Client sends `POST /api/v1/wallet/challenge` with `{ "wallet_address": "0x...", "chain_id": 31337 }`.
   - Backend creates an unguessable 16-byte random hex nonce and returns an EIP-191 formatted challenge text with a 10-minute expiry.
2. **MetaMask Signing**:
   - The browser prompts MetaMask to sign the plain text challenge using `signer.signMessage(challenge_text)` (`personal_sign`).
3. **Backend Signature Verification**:
   - Client submits signature and nonce to `POST /api/v1/wallet/verify`.
   - Backend reconstructs the deterministic challenge, decodes via `eth_account.messages.encode_defunct`, and recovers the public signer address using `Account.recover_message`.
   - Upon exact match, marks the wallet as `is_verified=True` and associates it with the authenticated user profile in `user_wallets`.

## 3. MetaMask Network Configuration
- **Network Name**: Hardhat Local EVM
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337` (`0x7a69`)
- **Currency Symbol**: `ETH`

