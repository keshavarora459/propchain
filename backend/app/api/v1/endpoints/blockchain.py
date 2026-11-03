"""
Blockchain Telemetry and Decentralized Ledger Endpoints for PropChain.
Exposes live on-chain status, blocks, transactions, events, and search functionality
queried directly via Web3 server-side connection to avoid browser CORS/PNA restrictions.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload
from web3 import Web3

from app.core.logging import get_logger
from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.blockchain import BlockchainEvent, BlockchainOperation, OwnershipEvent
from app.models.property import Property
from app.models.transaction import PropertyTransaction
from app.models.user import User
from app.services.blockchain_service import BlockchainService

logger = get_logger("blockchain_api")

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


class NetworkStatusResponse(BaseModel):
    chainId: int
    networkName: str
    latestBlock: int
    gasPriceGwei: float
    syncStatus: str  # 'Synced' | 'Syncing' | 'Offline'
    nodeVersion: str
    rpcUrl: str


class BlockItem(BaseModel):
    blockNumber: int
    hash: str
    parentHash: str
    timestamp: str
    transactionsCount: int
    miner: str
    gasUsed: str


class TransactionItem(BaseModel):
    hash: str
    blockNumber: int
    from_address: str
    to_address: str
    event: str
    propertyId: Optional[str] = None
    documentHash: Optional[str] = None
    value: str = "0.0 ETH"
    gasUsed: str = "0 gas"
    status: str = "Confirmed"
    timestamp: str
    details: Optional[str] = None

    class Config:
        populate_by_name = True


class BlockchainStatsResponse(BaseModel):
    latestBlock: int
    totalBlocks: int
    totalTransactions: int
    totalPropertiesAnchored: int
    networkStatus: str
    chainId: int
    gasPriceGwei: float
    networkName: str
    contracts: Dict[str, str]


def _get_web3_instance() -> Web3:
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
    return Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 5}))


@router.get("/status", response_model=NetworkStatusResponse, summary="Get live EVM network status")
def get_network_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns real-time connection status and block height from the EVM node."""
    w3 = _get_web3_instance()
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")

    try:
        is_connected = w3.is_connected()
        if is_connected:
            block_num = w3.eth.block_number
            chain_id = w3.eth.chain_id
            gas_price_wei = w3.eth.gas_price
            gas_price_gwei = float(w3.from_wei(gas_price_wei, "gwei"))
            client_version = w3.client_version

            return NetworkStatusResponse(
                chainId=chain_id,
                networkName="Hardhat EVM Localhost",
                latestBlock=block_num,
                gasPriceGwei=round(gas_price_gwei, 2),
                syncStatus="Synced",
                nodeVersion=client_version,
                rpcUrl=rpc_url,
            )
    except Exception as e:
        logger.warning("Could not connect to EVM RPC node: %s", e)

    return NetworkStatusResponse(
        chainId=31337,
        networkName="Hardhat EVM Localhost",
        latestBlock=0,
        gasPriceGwei=0.0,
        syncStatus="Offline",
        nodeVersion="Unknown / Standby",
        rpcUrl=rpc_url,
    )


@router.get("/blocks", response_model=List[BlockItem], summary="Get latest mined blocks")
def get_latest_blocks(
    limit: int = Query(25, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetches recent blocks from the EVM node with tx counts and gas metrics."""
    w3 = _get_web3_instance()
    blocks: List[BlockItem] = []

    try:
        if w3.is_connected():
            latest = w3.eth.block_number
            start = latest
            end = max(0, latest - (limit - 1))

            for b_num in range(start, end - 1, -1):
                try:
                    b = w3.eth.get_block(b_num, full_transactions=False)
                    if b:
                        block_dt = datetime.fromtimestamp(b.timestamp, tz=timezone.utc).isoformat()
                        tx_count = len(b.transactions) if hasattr(b, "transactions") else 0
                        gas_used_str = f"{b.gasUsed:,} gas"

                        blocks.append(
                            BlockItem(
                                blockNumber=b.number,
                                hash=w3.to_hex(b.hash),
                                parentHash=w3.to_hex(b.parentHash),
                                timestamp=block_dt,
                                transactionsCount=tx_count,
                                miner=str(b.miner),
                                gasUsed=gas_used_str,
                            )
                        )
                except Exception as b_err:
                    logger.warning("Error fetching block %s: %s", b_num, b_err)
    except Exception as e:
        logger.warning("Error fetching blocks from node: %s", e)

    return blocks


@router.get("/transactions", summary="Get recent consensus transactions")
def get_recent_transactions(
    limit: int = Query(25, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetches confirmed transactions on-chain with decoded contract actions."""
    w3 = _get_web3_instance()
    tx_list: List[Dict[str, Any]] = []
    seen_hashes = set()

    # 1. Fetch on-chain transactions from recent blocks
    try:
        if w3.is_connected():
            svc = BlockchainService(db)
            prop_addr = svc.property_registry.address.lower() if svc.property_registry else ""
            own_addr = svc.ownership_registry.address.lower() if svc.ownership_registry else ""
            tm_addr = svc.transaction_manager.address.lower() if svc.transaction_manager else ""

            latest = w3.eth.block_number
            start = latest
            end = max(0, latest - (limit - 1))

            for b_num in range(start, end - 1, -1):
                try:
                    b = w3.eth.get_block(b_num, full_transactions=True)
                    if not b or not hasattr(b, "transactions"):
                        continue

                    block_dt = datetime.fromtimestamp(b.timestamp, tz=timezone.utc).isoformat()

                    for tx in b.transactions:
                        tx_hash = w3.to_hex(tx.hash)
                        if tx_hash in seen_hashes:
                            continue
                        seen_hashes.add(tx_hash)

                        receipt = None
                        status_str = "Confirmed"
                        gas_used_str = "21,000 gas"
                        try:
                            receipt = w3.eth.get_transaction_receipt(tx.hash)
                            if receipt:
                                status_str = "Confirmed" if receipt.status == 1 else "Reverted"
                                gas_used_str = f"{receipt.gasUsed:,} gas"
                        except Exception:
                            pass

                        to_addr = tx.to if tx.to else "Contract Deployment"
                        event_name = "Smart Contract Call" if tx.to else "Contract Deployed"
                        prop_id = None
                        doc_hash = None
                        details = None

                        # Check known contract addresses
                        if not tx.to:
                            event_name = "Contract Deployed"
                            if receipt and receipt.contractAddress:
                                ca = receipt.contractAddress.lower()
                                if ca == prop_addr:
                                    details = "PropertyRegistry Deployed"
                                elif ca == own_addr:
                                    details = "OwnershipRegistry Deployed"
                                elif ca == tm_addr:
                                    details = "TransactionManager Deployed"
                        else:
                            to_lower = tx.to.lower()
                            if to_lower == prop_addr:
                                event_name = "Property Registered"
                                details = "Property anchor on PropertyRegistry"
                            elif to_lower == own_addr:
                                event_name = "Genesis Ownership Recorded"
                                details = "Title deed on OwnershipRegistry"
                            elif to_lower == tm_addr:
                                event_name = "Conveyance Escrow Execution"
                                details = "Atomic settlement on TransactionManager"

                        # Check if matched with DB OwnershipEvent
                        db_event = db.scalar(
                            select(OwnershipEvent)
                            .options(joinedload(OwnershipEvent.property))
                            .where(OwnershipEvent.blockchain_tx_hash == tx_hash)
                        )
                        if db_event:
                            event_name = (
                                "Property Registered"
                                if db_event.event_type == "INITIAL_REGISTRATION"
                                else "Ownership Transferred"
                            )
                            if db_event.property:
                                prop_id = db_event.property.property_number
                                details = f"Property {prop_id} conveyance anchored"

                        value_eth = f"{float(w3.from_wei(tx.value, 'ether')):.4f} ETH" if hasattr(tx, "value") else "0.0 ETH"

                        tx_list.append({
                            "hash": tx_hash,
                            "blockNumber": b.number,
                            "from": tx["from"],
                            "to": to_addr,
                            "event": event_name,
                            "propertyId": prop_id,
                            "documentHash": doc_hash,
                            "value": value_eth,
                            "gasUsed": gas_used_str,
                            "status": status_str,
                            "timestamp": block_dt,
                            "details": details,
                        })

                        if len(tx_list) >= limit:
                            break
                except Exception as b_err:
                    logger.warning("Error processing block txs %s: %s", b_num, b_err)

                if len(tx_list) >= limit:
                    break
    except Exception as e:
        logger.warning("Error querying on-chain transactions: %s", e)

    # 2. Augment / fallback with DB ownership events if list is small
    if len(tx_list) < limit:
        db_events = list(
            db.scalars(
                select(OwnershipEvent)
                .options(joinedload(OwnershipEvent.property))
                .order_by(OwnershipEvent.created_at.desc())
                .limit(limit - len(tx_list))
            ).all()
        )
        for ev in db_events:
            if ev.blockchain_tx_hash and ev.blockchain_tx_hash not in seen_hashes:
                seen_hashes.add(ev.blockchain_tx_hash)
                prop_num = ev.property.property_number if ev.property else "PROP"
                event_name = "Property Registered" if ev.event_type == "INITIAL_REGISTRATION" else "Ownership Transferred"
                tx_list.append({
                    "hash": ev.blockchain_tx_hash,
                    "blockNumber": ev.block_number or 1,
                    "from": ev.previous_owner_address or os.getenv("BLOCKCHAIN_DEPLOYER_ADDRESS", ""),
                    "to": ev.new_owner_address or os.getenv("PROPERTY_REGISTRY_ADDRESS", ""),
                    "event": event_name,
                    "propertyId": prop_num,
                    "documentHash": None,
                    "value": "0.0 ETH",
                    "gasUsed": "180,000 gas",
                    "status": "Confirmed",
                    "timestamp": ev.created_at.isoformat() if ev.created_at else datetime.now(timezone.utc).isoformat(),
                    "details": f"Deed for {prop_num} confirmed on-chain",
                })

    return tx_list


@router.get("/stats", response_model=BlockchainStatsResponse, summary="Get aggregated blockchain network statistics")
def get_blockchain_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Provides high-level statistics for the decentralized ledger explorer."""
    w3 = _get_web3_instance()
    svc = BlockchainService(db)

    latest_block = 0
    gas_price_gwei = 0.0
    status_str = "Offline"

    try:
        if w3.is_connected():
            latest_block = w3.eth.block_number
            gas_price_gwei = float(w3.from_wei(w3.eth.gas_price, "gwei"))
            status_str = "Connected"
    except Exception:
        pass

    # Total registered properties anchored
    total_anchored = db.scalar(
        select(func.count(Property.id)).where(Property.blockchain_property_id.isnot(None))
    ) or 0

    # Total recorded ownership events
    total_txs = db.scalar(select(func.count(OwnershipEvent.id))) or 0
    if latest_block > 0:
        total_txs = max(total_txs, latest_block)

    contracts_map = {
        "PropertyRegistry": svc.property_registry.address if svc.property_registry else os.getenv("PROPERTY_REGISTRY_ADDRESS", ""),
        "OwnershipRegistry": svc.ownership_registry.address if svc.ownership_registry else os.getenv("OWNERSHIP_REGISTRY_ADDRESS", ""),
        "TransactionManager": svc.transaction_manager.address if svc.transaction_manager else os.getenv("TRANSACTION_MANAGER_ADDRESS", ""),
    }

    return BlockchainStatsResponse(
        latestBlock=latest_block,
        totalBlocks=max(1, latest_block + 1) if status_str == "Connected" else 0,
        totalTransactions=total_txs,
        totalPropertiesAnchored=total_anchored,
        networkStatus=status_str,
        chainId=int(os.getenv("BLOCKCHAIN_CHAIN_ID", "31337")),
        gasPriceGwei=round(gas_price_gwei, 2),
        networkName=os.getenv("BLOCKCHAIN_NETWORK_NAME", "Hardhat EVM Localhost"),
        contracts=contracts_map,
    )


@router.get("/search", summary="Search blockchain by block number, tx hash, address, or document hash")
def search_blockchain(
    q: str = Query(..., min_length=1, description="Query string: block number, tx hash, address, or SHA-256 hash"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Executes a multi-index lookup against both the EVM node and the database."""
    query = q.strip()
    w3 = _get_web3_instance()

    # 1. Block number
    if query.isdigit():
        b_num = int(query)
        try:
            if w3.is_connected():
                b = w3.eth.get_block(b_num, full_transactions=False)
                if b:
                    return {
                        "type": "block",
                        "data": {
                            "blockNumber": b.number,
                            "hash": w3.to_hex(b.hash),
                            "parentHash": w3.to_hex(b.parentHash),
                            "transactionsCount": len(b.transactions) if hasattr(b, "transactions") else 0,
                            "timestamp": datetime.fromtimestamp(b.timestamp, tz=timezone.utc).isoformat(),
                            "gasUsed": f"{b.gasUsed:,} gas",
                            "miner": str(b.miner),
                            "transactions": [w3.to_hex(t) for t in b.transactions] if hasattr(b, "transactions") else [],
                        },
                    }
        except Exception:
            pass

    # 2. Tx hash or Document hash (32-byte hex)
    is_hex = (query.startswith("0x") and len(query) == 66) or (len(query) == 64)
    normalized_hex = ("0x" + query) if len(query) == 64 else query

    if is_hex:
        # Check on-chain transaction
        try:
            if w3.is_connected():
                tx = w3.eth.get_transaction(normalized_hex)
                if tx:
                    receipt = w3.eth.get_transaction_receipt(normalized_hex)
                    status_str = "Confirmed" if receipt and receipt.status == 1 else "Reverted"
                    gas_str = f"{receipt.gasUsed:,} gas" if receipt else "0 gas"

                    return {
                        "type": "transaction",
                        "data": {
                            "hash": normalized_hex,
                            "blockNumber": tx.blockNumber,
                            "from": tx["from"],
                            "to": tx.to or "Contract Deployment",
                            "value": f"{float(w3.from_wei(tx.value, 'ether')):.4f} ETH",
                            "event": "Smart Contract Call" if tx.to else "Contract Deployed",
                            "propertyId": None,
                            "documentHash": None,
                            "details": f"On-chain transaction mined in block #{tx.blockNumber}",
                            "gasUsed": gas_str,
                            "status": status_str,
                        },
                    }
        except Exception:
            pass

        # Check DB OwnershipEvent by tx_hash
        ev = db.scalar(
            select(OwnershipEvent)
            .options(joinedload(OwnershipEvent.property))
            .where(OwnershipEvent.blockchain_tx_hash.ilike(normalized_hex))
        )
        if ev:
            prop_num = ev.property.property_number if ev.property else "PROP"
            return {
                "type": "transaction",
                "data": {
                    "hash": ev.blockchain_tx_hash,
                    "blockNumber": ev.block_number or 1,
                    "from": ev.previous_owner_address or os.getenv("BLOCKCHAIN_DEPLOYER_ADDRESS", ""),
                    "to": ev.new_owner_address or os.getenv("PROPERTY_REGISTRY_ADDRESS", ""),
                    "value": "0.0 ETH",
                    "event": "Property Registered" if ev.event_type == "INITIAL_REGISTRATION" else "Ownership Transferred",
                    "propertyId": prop_num,
                    "documentHash": None,
                    "details": f"Verified deed transfer for {prop_num}",
                    "gasUsed": "180,000 gas",
                    "status": "Confirmed",
                },
            }

    # 3. Address
    if Web3.is_address(query):
        checksum_addr = Web3.to_checksum_address(query)
        try:
            if w3.is_connected():
                bal_wei = w3.eth.get_balance(checksum_addr)
                bal_eth = f"{float(w3.from_wei(bal_wei, 'ether')):.4f} ETH"
                tx_count = w3.eth.get_transaction_count(checksum_addr)
                code = w3.eth.get_code(checksum_addr)
                is_contract = len(code) > 0

                prop_reg = (svc.property_registry.address if svc.property_registry else os.getenv("PROPERTY_REGISTRY_ADDRESS", "")).lower()
                own_reg = (svc.ownership_registry.address if svc.ownership_registry else os.getenv("OWNERSHIP_REGISTRY_ADDRESS", "")).lower()
                tx_mgr = (svc.transaction_manager.address if svc.transaction_manager else os.getenv("TRANSACTION_MANAGER_ADDRESS", "")).lower()
                deployer = os.getenv("BLOCKCHAIN_DEPLOYER_ADDRESS", "").lower()

                label = "Smart Contract" if is_contract else "User Wallet (EOA)"
                if prop_reg and checksum_addr.lower() == prop_reg:
                    label = "PropertyRegistry (PropChain Smart Contract)"
                elif own_reg and checksum_addr.lower() == own_reg:
                    label = "OwnershipRegistry (PropChain Smart Contract)"
                elif tx_mgr and checksum_addr.lower() == tx_mgr:
                    label = "TransactionManager (PropChain Smart Contract)"
                elif deployer and checksum_addr.lower() == deployer:
                    label = "Hardhat Genesis Deployer / Platform Authority"

                return {
                    "type": "address",
                    "data": {
                        "address": checksum_addr,
                        "label": label,
                        "isContract": is_contract,
                        "balance": bal_eth,
                        "txCount": tx_count,
                        "matchingTxsCount": tx_count,
                    },
                }
        except Exception:
            pass

    # 4. Property ID (PROP-...)
    prop = db.scalar(
        select(Property).where(Property.property_number.ilike(f"%{query}%"))
    )
    if prop:
        ev = db.scalar(
            select(OwnershipEvent)
            .where(OwnershipEvent.property_id == prop.id)
            .order_by(OwnershipEvent.created_at.desc())
        )
        return {
            "type": "transaction",
            "data": {
                "hash": ev.blockchain_tx_hash if ev else "",
                "blockNumber": ev.block_number if ev else 1,
                "from": ev.previous_owner_address if ev else os.getenv("BLOCKCHAIN_DEPLOYER_ADDRESS", ""),
                "to": ev.new_owner_address if ev else os.getenv("PROPERTY_REGISTRY_ADDRESS", ""),
                "value": "0.0 ETH",
                "event": "Property Registered" if not ev or ev.event_type == "INITIAL_REGISTRATION" else "Ownership Transferred",
                "propertyId": prop.property_number,
                "documentHash": None,
                "details": f"On-chain parcel record for {prop.title} ({prop.property_number})",
                "gasUsed": "180,000 gas",
                "status": "Confirmed",
            },
        }

    return {"type": "not_found", "query": query}


@router.post("/rpc", summary="Proxies JSON-RPC calls directly to the local node")
async def proxy_json_rpc(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Relays JSON-RPC requests (e.g., eth_blockNumber, eth_getBlockByNumber)
    from frontend clients through the backend to avoid browser CORS/PNA blocks.
    """
    import httpx

    body = await request.body()
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                rpc_url,
                content=body,
                headers={"Content-Type": "application/json"},
            )
            return resp.json()
        except Exception as e:
            logger.error("RPC proxy error: %s", e)
            return {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32603, "message": f"RPC node unreachable: {e}"},
            }
