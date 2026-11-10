"""
Web3 Blockchain Integration Service for PropChain.
Manages smart contract interaction, transaction submission, receipt verification, and dual-state synchronization.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from web3 import Web3

from app.core.logging import get_logger
from app.models.blockchain import BlockchainEvent, BlockchainOperation, OwnershipEvent
from app.models.property import Property
from app.models.wallet import UserWallet

logger = get_logger("blockchain_service")


class BlockchainService:
    def __init__(self, db: Session):
        self.db = db
        rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))

        # Hardhat account #0 default private key for local development
        raw_key = os.getenv("BLOCKCHAIN_DEPLOYER_PRIVATE_KEY")
        self.deployer_private_key = (
            raw_key.strip() if raw_key and raw_key.strip()
            else "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        )
        try:
            self.deployer_account = self.w3.eth.account.from_key(self.deployer_private_key)
        except Exception as key_err:
            logger.warning("Could not initialize deployer account: %s", key_err)
            self.deployer_account = None

        self._load_contracts()

    def _load_contracts(self):
        custom_dir = os.getenv("BLOCKCHAIN_DEPLOYMENTS_DIR")
        if custom_dir and Path(custom_dir).is_dir():
            deployments_dir = Path(custom_dir)
        else:
            repo_root = Path(__file__).resolve().parent.parent.parent.parent
            deployments_dir = repo_root / "blockchain" / "deployments"
        chain_id = os.getenv("BLOCKCHAIN_CHAIN_ID", "31337")

        deployment_file = (
            deployments_dir / "sepolia.json"
            if chain_id == "11155111" and (deployments_dir / "sepolia.json").is_file()
            else deployments_dir / "localhost.json"
        )

        self.property_registry = None
        self.ownership_registry = None
        self.transaction_manager = None

        if deployment_file.is_file():
            try:
                data = json.loads(deployment_file.read_text())
                contracts = data.get("contracts", {})

                if "PropertyRegistry" in contracts and self.w3.is_connected():
                    self.property_registry = self.w3.eth.contract(
                        address=Web3.to_checksum_address(contracts["PropertyRegistry"]["address"]),
                        abi=contracts["PropertyRegistry"]["abi"],
                    )

                if "OwnershipRegistry" in contracts and self.w3.is_connected():
                    self.ownership_registry = self.w3.eth.contract(
                        address=Web3.to_checksum_address(contracts["OwnershipRegistry"]["address"]),
                        abi=contracts["OwnershipRegistry"]["abi"],
                    )

                if "TransactionManager" in contracts and self.w3.is_connected():
                    self.transaction_manager = self.w3.eth.contract(
                        address=Web3.to_checksum_address(contracts["TransactionManager"]["address"]),
                        abi=contracts["TransactionManager"]["abi"],
                    )
            except Exception as e:
                logger.warning("Could not initialize contracts from deployment artifact: %s", e)

    @classmethod
    def get_contract_address(cls) -> Optional[str]:
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        deployment_file = repo_root / "blockchain" / "deployments" / "localhost.json"
        if deployment_file.is_file():
            try:
                data = json.loads(deployment_file.read_text())
                return data.get("contracts", {}).get("PropertyRegistry", {}).get("address")
            except Exception:
                pass
        return "0x5FbDB2315678afecb367f032d93F642f64180aa3"

    def is_network_connected(self) -> bool:
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def anchor_property(
        self,
        prop: Property,
        owner_wallet: str,
        document_hash_hex: str,
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Submits on-chain property registration and initial ownership anchor to EVM.
        Prevents duplicate submissions when retrying.
        Returns: (success, tx_hash, error_message)
        """
        if not self.is_network_connected() or not self.property_registry or not self.ownership_registry or not self.deployer_account:
            # Record failed or skipped operation in DB
            op = BlockchainOperation(
                operation_type="REGISTER_PROPERTY",
                entity_type="PROPERTY",
                entity_id=prop.id,
                status="FAILED",
                error_message="Blockchain EVM node or contract interface unavailable.",
            )
            self.db.add(op)
            self.db.commit()
            return False, None, "Blockchain EVM node unreachable or contracts not deployed."

        # 1. Find or initialize operation record in DB
        op = (
            self.db.query(BlockchainOperation)
            .filter(
                BlockchainOperation.entity_id == prop.id,
                BlockchainOperation.operation_type == "REGISTER_PROPERTY",
            )
            .order_by(BlockchainOperation.created_at.desc())
            .first()
        )
        if op is None:
            op = BlockchainOperation(
                operation_type="REGISTER_PROPERTY",
                entity_type="PROPERTY",
                entity_id=prop.id,
                status="PENDING",
            )
            self.db.add(op)
        else:
            op.retry_count = (op.retry_count or 0) + 1
            op.status = "PENDING"
            op.error_message = None
        self.db.commit()

        try:
            checksum_owner = Web3.to_checksum_address(owner_wallet)

            # Convert 32-byte hash
            clean_hash = (document_hash_hex or "").replace("0x", "")[:64]
            try:
                doc_hash_bytes = bytes.fromhex(clean_hash) if clean_hash else bytes(32)
            except ValueError:
                doc_hash_bytes = bytes(32)
            if len(doc_hash_bytes) < 32:
                doc_hash_bytes = doc_hash_bytes.ljust(32, b"\x00")

            onchain_tx_hash: Optional[str] = op.tx_hash
            onchain_block_num: Optional[int] = op.block_number

            # 2. Check if already registered on PropertyRegistry
            already_registered = False
            try:
                prop_data = self.property_registry.functions.getProperty(prop.property_number).call()
                # prop_data: (currentOwner, documentHash, state, registeredAt, updatedAt, exists)
                if len(prop_data) >= 6 and prop_data[5]:
                    already_registered = True
                    logger.info("Property %s already exists in PropertyRegistry", prop.property_number)
            except Exception as check_err:
                logger.warning("Could not check getProperty for %s: %s", prop.property_number, check_err)

            if not already_registered:
                nonce = self.w3.eth.get_transaction_count(self.deployer_account.address, "pending")
                tx = self.property_registry.functions.registerProperty(
                    prop.property_number,
                    checksum_owner,
                    doc_hash_bytes,
                ).build_transaction({
                    "from": self.deployer_account.address,
                    "nonce": nonce,
                    "gas": 300000,
                    "gasPrice": self.w3.eth.gas_price,
                })

                signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.deployer_private_key)
                tx_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                onchain_tx_hash = self.w3.to_hex(tx_hash_bytes)

                op.tx_hash = onchain_tx_hash
                op.status = "SUBMITTED"
                self.db.commit()

                # Wait for receipt
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=10)
                if receipt["status"] != 1:
                    op.status = "REVERTED"
                    op.error_message = "PropertyRegistry transaction reverted on chain."
                    self.db.commit()
                    return False, onchain_tx_hash, "PropertyRegistry transaction reverted on chain."

                onchain_block_num = receipt["blockNumber"]

            # 3. Check if initial ownership is already recorded in OwnershipRegistry
            already_owned = False
            try:
                curr_owner = self.ownership_registry.functions.getCurrentOwner(prop.property_number).call()
                if curr_owner and curr_owner != "0x0000000000000000000000000000000000000000":
                    already_owned = True
                    logger.info("Ownership for %s already recorded in OwnershipRegistry", prop.property_number)
            except Exception as check_err:
                logger.warning("Could not check getCurrentOwner for %s: %s", prop.property_number, check_err)

            if not already_owned:
                nonce2 = self.w3.eth.get_transaction_count(self.deployer_account.address, "pending")
                tx2 = self.ownership_registry.functions.recordInitialOwnership(
                    prop.property_number,
                    checksum_owner,
                ).build_transaction({
                    "from": self.deployer_account.address,
                    "nonce": nonce2,
                    "gas": 300000,
                    "gasPrice": self.w3.eth.gas_price,
                })
                signed_tx2 = self.w3.eth.account.sign_transaction(tx2, private_key=self.deployer_private_key)
                tx2_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx2.raw_transaction)
                receipt2 = self.w3.eth.wait_for_transaction_receipt(tx2_hash_bytes, timeout=10)
                if receipt2["status"] != 1:
                    op.status = "REVERTED"
                    op.error_message = "OwnershipRegistry transaction reverted on chain."
                    self.db.commit()
                    return False, self.w3.to_hex(tx2_hash_bytes), "OwnershipRegistry transaction reverted on chain."

                if not onchain_tx_hash:
                    onchain_tx_hash = self.w3.to_hex(tx2_hash_bytes)
                if not onchain_block_num:
                    onchain_block_num = receipt2["blockNumber"]

            # If both were already registered and we had no block/tx info, fallback
            if not onchain_block_num:
                try:
                    onchain_block_num = self.w3.eth.block_number
                except Exception:
                    onchain_block_num = 1

            if not onchain_tx_hash:
                onchain_tx_hash = f"0x{'0'*64}"

            # Query real block timestamp
            block_timestamp = None
            if onchain_block_num:
                try:
                    block_info = self.w3.eth.get_block(onchain_block_num)
                    if block_info and "timestamp" in block_info:
                        block_timestamp = datetime.fromtimestamp(block_info["timestamp"], tz=timezone.utc)
                except Exception as b_err:
                    logger.warning("Could not fetch block %s details: %s", onchain_block_num, b_err)
            if not block_timestamp:
                block_timestamp = datetime.now(timezone.utc)

            # 4. Update DB state
            op.status = "CONFIRMED"
            op.tx_hash = onchain_tx_hash
            op.block_number = onchain_block_num
            op.error_message = None

            prop.blockchain_property_id = prop.property_number
            prop.blockchain_tx_hash = onchain_tx_hash
            prop.blockchain_block_number = onchain_block_num
            prop.blockchain_anchored_at = block_timestamp

            # Check or create initial ownership event
            genesis_event = (
                self.db.query(OwnershipEvent)
                .filter(
                    OwnershipEvent.property_id == prop.id,
                    OwnershipEvent.event_type == "INITIAL_REGISTRATION",
                )
                .first()
            )
            if not genesis_event:
                genesis_event = OwnershipEvent(
                    property_id=prop.id,
                    previous_owner_id=None,
                    new_owner_id=prop.creator_user_id or prop.current_owner_id,
                    previous_owner_address=None,
                    new_owner_address=checksum_owner,
                    transaction_id="GENESIS",
                    event_type="INITIAL_REGISTRATION",
                    blockchain_tx_hash=onchain_tx_hash,
                    block_number=onchain_block_num,
                    confirmed_at=block_timestamp,
                )
                self.db.add(genesis_event)
            else:
                if onchain_tx_hash and not genesis_event.blockchain_tx_hash:
                    genesis_event.blockchain_tx_hash = onchain_tx_hash
                if onchain_block_num and not genesis_event.block_number:
                    genesis_event.block_number = onchain_block_num
                if not genesis_event.confirmed_at:
                    genesis_event.confirmed_at = block_timestamp

            # Record BlockchainEvent for explorer indexing
            reg_contract_addr = self.get_contract_address() or "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            existing_event = (
                self.db.query(BlockchainEvent)
                .filter(
                    BlockchainEvent.tx_hash == onchain_tx_hash,
                    BlockchainEvent.event_name == "PropertyRegistered",
                )
                .first()
            )
            if not existing_event:
                bc_event = BlockchainEvent(
                    contract_address=reg_contract_addr,
                    event_name="PropertyRegistered",
                    block_number=onchain_block_num or 0,
                    tx_hash=onchain_tx_hash,
                    log_index=0,
                    payload={
                        "property_id": prop.property_number,
                        "owner_wallet": checksum_owner,
                        "document_hash": document_hash_hex,
                        "timestamp": int(block_timestamp.timestamp()),
                    },
                )
                self.db.add(bc_event)

            self.db.commit()
            return True, onchain_tx_hash, None

        except Exception as e:
            logger.error("Error anchoring property %s on chain: %s", prop.property_number, e)
            op.status = "FAILED"
            op.error_message = str(e)
            self.db.commit()
            return False, None, str(e)

    def execute_ownership_transfer(
        self,
        prop: Property,
        previous_owner_user_id: Optional[uuid.UUID],
        new_owner_user_id: uuid.UUID,
        previous_owner_address: str,
        new_owner_address: str,
        transaction_id_str: str,
        is_fractional: bool = False,
        token_quantity: Optional[int] = None,
        ownership_percentage: Optional[float] = None,
    ) -> Tuple[bool, Optional[str], Optional[int], Optional[str]]:
        """
        Executes on-chain transfer in OwnershipRegistry and updates local ownership history.
        Returns: (success, tx_hash, block_number, error_message)
        """
        if not self.is_network_connected() or not self.ownership_registry or not self.deployer_account:
            return False, None, None, "Blockchain EVM node unreachable or contracts not deployed."

        from app.core.config import get_settings
        settings = get_settings()

        # Fallback to PLATFORM_CUSTODY_WALLET if addresses are not provided
        if not previous_owner_address or not str(previous_owner_address).strip():
            previous_owner_address = settings.PLATFORM_CUSTODY_WALLET
        if not new_owner_address or not str(new_owner_address).strip():
            new_owner_address = settings.PLATFORM_CUSTODY_WALLET

        onchain_property_id = (
            f"{prop.property_number}-TKN-{transaction_id_str}"
            if is_fractional
            else prop.property_number
        )
        transfer_event_type = "TOKEN_TRANSFER" if is_fractional else "TRANSFER"

        op = BlockchainOperation(
            operation_type="TRANSFER_TOKEN_SHARE" if is_fractional else "TRANSFER_OWNERSHIP",
            entity_type="TRANSACTION",
            entity_id=prop.id,
            status="PENDING",
        )
        self.db.add(op)
        self.db.commit()

        try:
            # Check recorded current owner on-chain to match registeredCurrent in contract
            try:
                curr_owner = self.ownership_registry.functions.getCurrentOwner(onchain_property_id).call()
                if curr_owner and curr_owner != "0x0000000000000000000000000000000000000000":
                    prev_addr = curr_owner
                else:
                    prev_addr = Web3.to_checksum_address(previous_owner_address)
            except Exception:
                prev_addr = Web3.to_checksum_address(previous_owner_address)

            new_addr = Web3.to_checksum_address(new_owner_address)

            nonce = self.w3.eth.get_transaction_count(self.deployer_account.address, "pending")
            tx = self.ownership_registry.functions.recordOwnershipTransfer(
                onchain_property_id,
                prev_addr,
                new_addr,
                transaction_id_str,
            ).build_transaction({
                "from": self.deployer_account.address,
                "nonce": nonce,
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price,
            })

            signed = self.w3.eth.account.sign_transaction(tx, private_key=self.deployer_private_key)
            tx_hash_bytes = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hash = self.w3.to_hex(tx_hash_bytes)

            op.tx_hash = tx_hash
            op.status = "SUBMITTED"
            self.db.commit()

            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=10)
            if receipt["status"] != 1:
                op.status = "REVERTED"
                op.error_message = "Transfer transaction reverted on chain."
                self.db.commit()
                return False, tx_hash, None, "Transfer transaction reverted on chain."

            block_num = receipt["blockNumber"]
            op.status = "CONFIRMED"
            op.block_number = block_num

            # Fetch authentic block timestamp
            block_timestamp = None
            try:
                block_info = self.w3.eth.get_block(block_num)
                if block_info and "timestamp" in block_info:
                    block_timestamp = datetime.fromtimestamp(block_info["timestamp"], tz=timezone.utc)
            except Exception:
                pass
            if not block_timestamp:
                block_timestamp = datetime.now(timezone.utc)

            # Record ownership event
            transfer_event = OwnershipEvent(
                property_id=prop.id,
                previous_owner_id=previous_owner_user_id,
                new_owner_id=new_owner_user_id,
                previous_owner_address=prev_addr,
                new_owner_address=new_addr,
                transaction_id=transaction_id_str,
                event_type=transfer_event_type,
                blockchain_tx_hash=tx_hash,
                block_number=block_num,
                confirmed_at=block_timestamp,
            )
            self.db.add(transfer_event)

            # Record blockchain event for explorer indexing
            reg_contract_addr = self.ownership_registry.address or self.get_contract_address() or "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
            bc_payload = {
                "property_id": prop.property_number,
                "onchain_asset_id": onchain_property_id,
                "previous_owner": prev_addr,
                "new_owner": new_addr,
                "transaction_id": transaction_id_str,
                "transfer_mode": "FRACTIONAL_TOKEN" if is_fractional else "ENTIRE_PROPERTY",
                "timestamp": int(block_timestamp.timestamp()),
            }
            if is_fractional and token_quantity is not None:
                bc_payload["token_quantity"] = token_quantity
                if ownership_percentage is not None:
                    bc_payload["ownership_percentage"] = ownership_percentage

            bc_event = BlockchainEvent(
                contract_address=reg_contract_addr,
                event_name="OwnershipTransferred",
                block_number=block_num,
                tx_hash=tx_hash,
                log_index=0,
                payload=bc_payload,
            )
            self.db.add(bc_event)
            self.db.commit()

            return True, tx_hash, block_num, None

        except Exception as e:
            logger.error("Error transferring ownership on chain: %s", e)
            op.status = "FAILED"
            op.error_message = str(e)
            self.db.commit()
            return False, None, None, str(e)

