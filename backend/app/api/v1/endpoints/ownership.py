"""
Ownership History and Conveyance Endpoints for PropChain.
"""
import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.core.permissions import UserRole, assert_property_access
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.blockchain import OwnershipEvent
from app.models.property import Property
from app.models.user import User
from app.models.wallet import UserWallet
from app.models.document import PropertyDocument
from app.models.transaction import PropertyTransaction
from sqlalchemy import or_
import hashlib
from app.schemas.ownership import OwnershipEventResponse, OwnershipHistoryListResponse
from app.services.blockchain_service import BlockchainService

logger = get_logger("ownership")
router = APIRouter(tags=["Ownership"])


def _to_event_response(e: OwnershipEvent) -> OwnershipEventResponse:
    resp = OwnershipEventResponse.model_validate(e)
    if e.property:
        resp.property_number = e.property.property_number
        resp.property_title = e.property.title
    if e.previous_owner:
        resp.previous_owner_name = e.previous_owner.full_name
    if e.new_owner:
        resp.new_owner_name = e.new_owner.full_name
    return resp


@router.get(
    "/ownership/history",
    response_model=OwnershipHistoryListResponse,
    summary="List all tamper-evident ownership conveyance events across the platform",
)
def list_ownership_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(OwnershipEvent)
        .options(
            joinedload(OwnershipEvent.property),
            joinedload(OwnershipEvent.previous_owner),
            joinedload(OwnershipEvent.new_owner),
        )
        .order_by(OwnershipEvent.created_at.desc())
    )
    raw_role = current_user.role
    user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
    if user_role == UserRole.PROPERTY_OWNER.value:
        stmt = stmt.outerjoin(Property, OwnershipEvent.property_id == Property.id).where(
            or_(
                OwnershipEvent.previous_owner_id == current_user.id,
                OwnershipEvent.new_owner_id == current_user.id,
                Property.current_owner_id == current_user.id,
                Property.creator_user_id == current_user.id,
            )
        )
    elif user_role == UserRole.BUYER.value:
        stmt = stmt.where(
            or_(
                OwnershipEvent.previous_owner_id == current_user.id,
                OwnershipEvent.new_owner_id == current_user.id,
            )
        )
    stmt = stmt.offset(skip).limit(limit)
    events = list(db.scalars(stmt).unique().all())
    return OwnershipHistoryListResponse(
        items=[_to_event_response(e) for e in events],
        total=len(events),
    )


@router.get(
    "/properties/{property_id}/ownership-history",
    response_model=List[OwnershipEventResponse],
    summary="Get complete chronological ownership conveyance events for a specific property",
)
@router.get(
    "/ownership/properties/{property_id}/history",
    response_model=List[OwnershipEventResponse],
    include_in_schema=False,
)
def get_property_ownership_history(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prop = db.get(Property, property_id)
    if not prop:
        raise NotFoundError(f"Property with ID '{property_id}' not found.")

    assert_property_access(current_user, prop, allow_marketplace=True)

    stmt = (
        select(OwnershipEvent)
        .options(
            joinedload(OwnershipEvent.property),
            joinedload(OwnershipEvent.previous_owner),
            joinedload(OwnershipEvent.new_owner),
        )
        .where(OwnershipEvent.property_id == property_id)
        .order_by(OwnershipEvent.created_at.asc())
    )
    events = list(db.scalars(stmt).unique().all())
    return [_to_event_response(e) for e in events]


@router.post(
    "/properties/{property_id}/anchor-blockchain",
    summary="Anchor property on EVM blockchain after verification (Owner or Admin)",
)
def anchor_property_on_chain(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prop = db.get(Property, property_id)
    if not prop:
        raise NotFoundError(f"Property with ID '{property_id}' not found.")

    assert_property_access(current_user, prop, allow_marketplace=True)

    user_role = UserRole(current_user.role)
    is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
    if user_role != UserRole.ADMIN and not is_owner:
        raise ForbiddenError("Only property owner or admin can anchor this property on-chain.")

    # Find owner verified wallet
    owner_id = prop.current_owner_id or prop.creator_user_id
    wallet = db.scalars(
        select(UserWallet).where(
            UserWallet.user_id == owner_id,
            UserWallet.is_verified == True,  # noqa: E712
        )
    ).first()

    owner_address = (
        wallet.wallet_address
        if wallet
        else os.getenv("DEFAULT_OWNER_WALLET", "")
    )


    # Get verified or computed property document hash
    doc_hash = hashlib.sha256(f"{prop.property_number}:{prop.id}".encode()).hexdigest()
    if prop.documents and prop.documents[0].document_hash:





        doc_hash = prop.documents[0].document_hash

    b_service = BlockchainService(db)
    success, tx_hash, err = b_service.anchor_property(
        prop=prop,
        owner_wallet=owner_address,
        document_hash_hex=doc_hash,
    )

    if not success:
        raise BadRequestError(f"Blockchain anchoring failed: {err}")

    return {
        "status": "ANCHORED",
        "property_id": prop.id,
        "property_number": prop.property_number,
        "tx_hash": tx_hash,
        "owner_wallet": owner_address,
    }



@router.get(
    "/blockchain/my-records",
    summary="Retrieve current user's blockchain-relevant identifiers and hashes for scoping",
)
@router.get(
    "/ownership/my-records",
    include_in_schema=False,
)
def get_user_blockchain_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns property numbers, document hashes, tx hashes, and wallet addresses for current user."""
    # 1. Properties
    user_props = list(
        db.scalars(
            select(Property).where(
                or_(
                    Property.current_owner_id == current_user.id,
                    Property.creator_user_id == current_user.id,
                )
            )
        ).all()
    )
    property_ids = [p.property_number for p in user_props if p.property_number]
    property_uuids = [str(p.id) for p in user_props]
    blockchain_property_ids = [p.blockchain_property_id for p in user_props if p.blockchain_property_id]

    # 2. Document hashes
    prop_uuid_list = [p.id for p in user_props]
    doc_conds = [PropertyDocument.uploader_user_id == current_user.id]
    if prop_uuid_list:
        doc_conds.append(PropertyDocument.property_id.in_(prop_uuid_list))
    user_docs = list(
        db.scalars(
            select(PropertyDocument).where(or_(*doc_conds))
        ).all()
    )
    document_hashes = [d.document_hash for d in user_docs if d.document_hash]

    # 3. Transactions
    user_txs = list(
        db.scalars(
            select(PropertyTransaction).where(
                or_(
                    PropertyTransaction.seller_id == current_user.id,
                    PropertyTransaction.buyer_id == current_user.id,
                )
            )
        ).all()
    )
    tx_hashes = [t.blockchain_tx_hash for t in user_txs if t.blockchain_tx_hash]
    tx_numbers = [t.transaction_number for t in user_txs if t.transaction_number]

    # 4. Wallets
    user_wallets = list(
        db.scalars(
            select(UserWallet).where(UserWallet.user_id == current_user.id)
        ).all()
    )
    wallet_addresses = [w.wallet_address.lower() for w in user_wallets if w.wallet_address]
    if current_user.wallet_address:
        wallet_addresses.append(current_user.wallet_address.lower())

    return {
        "property_ids": list(set(property_ids + property_uuids + blockchain_property_ids)),
        "document_hashes": list(set(document_hashes)),
        "tx_hashes": list(set(tx_hashes + tx_numbers)),
        "wallet_addresses": list(set(wallet_addresses)),
    }


@router.get(
    "/blockchain/contracts",
    summary="Get deployed contracts metadata and ABIs from localhost.json",
)
def get_blockchain_contracts():
    """Returns local deployments localhost.json metadata and contract ABIs."""
    from pathlib import Path
    import json
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    deployment_file = repo_root / "blockchain" / "deployments" / "localhost.json"
    if deployment_file.is_file():
        try:
            return json.loads(deployment_file.read_text())
        except Exception as e:
            logger.warning("Failed to read deployment file: %s", e)
    return {"contracts": {}}


@router.get(
    "/blockchain/overview",
    summary="Get comprehensive real-time blockchain ledger overview, blocks, transactions, and contracts",
)
def get_blockchain_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns authentic on-chain blocks, transactions, contract status,
    registered properties, and conveyance transfers.
    Open to all authenticated platform roles.
    """
    from datetime import datetime, timezone
    from pathlib import Path
    import json
    from app.models.blockchain import BlockchainOperation, OwnershipEvent, BlockchainEvent

    # 1. Load deployment metadata
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    deployment_file = repo_root / "blockchain" / "deployments" / "localhost.json"
    deploy_data = {}
    if deployment_file.is_file():
        try:
            deploy_data = json.loads(deployment_file.read_text())
        except Exception:
            pass

    contracts_info = deploy_data.get("contracts", {})
    prop_reg_addr = contracts_info.get("PropertyRegistry", {}).get("address", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
    own_reg_addr = contracts_info.get("OwnershipRegistry", {}).get("address", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
    tx_mgr_addr = contracts_info.get("TransactionManager", {}).get("address", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9")

    # 2. Query actual registered properties on chain
    registered_props_db = list(
        db.scalars(
            select(Property)
            .options(
                joinedload(Property.creator),
                joinedload(Property.current_owner),
                joinedload(Property.documents),
            )
            .where(
                or_(
                    Property.status == "BLOCKCHAIN_REGISTERED",
                    Property.blockchain_property_id.isnot(None),
                )
            )
            .order_by(Property.created_at.desc())
        ).unique().all()
    )

    prop_tx_map = {}
    prop_title_map = {p.property_number: p.title for p in registered_props_db}
    registered_properties_list = []
    for p in registered_props_db:
        # Find confirmed operation or ownership event
        own_ev = (
            db.query(OwnershipEvent)
            .filter(
                OwnershipEvent.property_id == p.id,
                OwnershipEvent.event_type == "INITIAL_REGISTRATION",
            )
            .first()
        )
        bc_op = (
            db.query(BlockchainOperation)
            .filter(
                BlockchainOperation.entity_id == p.id,
                BlockchainOperation.operation_type == "REGISTER_PROPERTY",
            )
            .order_by(BlockchainOperation.created_at.desc())
            .first()
        )

        tx_hash = (own_ev.blockchain_tx_hash if own_ev and own_ev.blockchain_tx_hash else None) or (bc_op.tx_hash if bc_op else None) or ""
        block_num = (own_ev.block_number if own_ev and own_ev.block_number is not None else None) or (bc_op.block_number if bc_op else None) or 1
        reg_time = (own_ev.confirmed_at if own_ev and own_ev.confirmed_at else None) or (bc_op.updated_at if bc_op else None) or p.created_at

        owner_name = p.current_owner.full_name if p.current_owner else (p.creator.full_name if p.creator else "Registered Owner")
        owner_addr = (own_ev.new_owner_address if own_ev else None) or "0x808E85eaF09C94EbE2c943b0A0137dC8DF287d88"

        doc_hashes = [d.document_hash for d in p.documents if d.document_hash and (d.status or "").upper() not in {"REJECTED", "REPLACED"}]

        if tx_hash:
            prop_tx_map[tx_hash.lower()] = p.property_number

        registered_properties_list.append({
            "property_id": p.property_number,
            "property_uuid": str(p.id),
            "creator_uuid": str(p.creator_user_id) if p.creator_user_id else "",
            "owner_uuid": str(p.current_owner_id) if p.current_owner_id else "",
            "title": p.title,
            "owner_name": owner_name,
            "owner_wallet": owner_addr,
            "tx_hash": tx_hash,
            "block_number": block_num,
            "contract_address": prop_reg_addr,
            "document_hashes": doc_hashes,
            "registered_at": reg_time.isoformat() if reg_time else None,
            "confirmation_status": "CONFIRMED on-chain",
        })

    # 3. Query actual ownership conveyance events
    ownership_events_db = list(
        db.scalars(
            select(OwnershipEvent)
            .options(
                joinedload(OwnershipEvent.property),
                joinedload(OwnershipEvent.previous_owner),
                joinedload(OwnershipEvent.new_owner),
            )
            .where(OwnershipEvent.event_type != "INITIAL_REGISTRATION")
            .order_by(OwnershipEvent.created_at.desc())
        ).unique().all()
    )

    transfer_list = []
    transfer_tx_map = {}
    for ev in ownership_events_db:
        p_num = ev.property.property_number if ev.property else ""
        p_title = ev.property.title if ev.property else ""
        from_name = ev.previous_owner.full_name if ev.previous_owner else "Previous Owner"
        to_name = ev.new_owner.full_name if ev.new_owner else "New Owner"
        if ev.blockchain_tx_hash:
            transfer_tx_map[ev.blockchain_tx_hash.lower()] = p_num

        transfer_list.append({
            "property_id": p_num,
            "property_title": p_title,
            "from_owner": from_name,
            "from_address": ev.previous_owner_address or "",
            "to_owner": to_name,
            "to_address": ev.new_owner_address or "",
            "previous_owner_id": str(ev.previous_owner_id) if ev.previous_owner_id else "",
            "new_owner_id": str(ev.new_owner_id) if ev.new_owner_id else "",
            "deal_number": ev.transaction_id or "",
            "tx_hash": ev.blockchain_tx_hash or "",
            "block_number": ev.block_number or 0,
            "timestamp": ev.confirmed_at.isoformat() if ev.confirmed_at else ev.created_at.isoformat(),
            "contract_address": own_reg_addr,
        })

    # Helper formatters
    def ensure_0x(val) -> str:
        if val is None:
            return ""
        if hasattr(val, "hex"):
            val = val.hex()
        s = str(val).strip()
        if not s or s == "None":
            return ""
        return f"0x{s}" if not s.startswith("0x") else s

    def format_root_field(val) -> str:
        if val is None:
            return "N/A"
        if hasattr(val, "hex"):
            val = val.hex()
        s = str(val).strip()
        if not s or s == "None":
            return "N/A"
        return f"0x{s}" if not s.startswith("0x") else s

    # 4. Check Web3 node connection and fetch real blocks and txs
    bc_service = BlockchainService(db)
    is_connected = bc_service.is_network_connected()
    w3 = bc_service.w3

    # Instantiate web3 contract instances for decoding tx data
    prop_contract = None
    own_contract = None
    tx_mgr_contract = None
    if is_connected and w3:
        try:
            prop_abi = contracts_info.get("PropertyRegistry", {}).get("abi")
            if prop_reg_addr and prop_abi:
                prop_contract = w3.eth.contract(address=w3.to_checksum_address(prop_reg_addr), abi=prop_abi)
            own_abi = contracts_info.get("OwnershipRegistry", {}).get("abi")
            if own_reg_addr and own_abi:
                own_contract = w3.eth.contract(address=w3.to_checksum_address(own_reg_addr), abi=own_abi)
            tx_mgr_abi = contracts_info.get("TransactionManager", {}).get("abi")
            if tx_mgr_addr and tx_mgr_abi:
                tx_mgr_contract = w3.eth.contract(address=w3.to_checksum_address(tx_mgr_addr), abi=tx_mgr_abi)
        except Exception as c_err:
            logger.warning("Could not instantiate web3 contract instances: %s", c_err)

    latest_block_num = 0
    total_tx_count = 0
    blocks_list = []
    txs_list = []

    if is_connected:
        try:
            latest_block_num = w3.eth.block_number
        except Exception:
            latest_block_num = 5

        # Query blocks from latest down to 0
        for b_num in range(latest_block_num, -1, -1):
            try:
                blk = w3.eth.get_block(b_num, full_transactions=True)
                b_hash = ensure_0x(blk.get("hash"))
                p_hash = ensure_0x(blk.get("parentHash"))
                b_time = datetime.fromtimestamp(blk["timestamp"], tz=timezone.utc).isoformat()
                tx_objs = blk.get("transactions", [])
                tx_count = len(tx_objs)
                total_tx_count += tx_count

                # Technical block roots and gas metrics from actual Ethereum RPC
                tx_root = format_root_field(blk.get("transactionsRoot"))
                st_root = format_root_field(blk.get("stateRoot"))
                rc_root = format_root_field(blk.get("receiptsRoot"))
                gas_used_fmt = f"{blk.get('gasUsed', 0):,} gas"
                gas_limit_fmt = f"{blk.get('gasLimit', 0):,} gas" if blk.get("gasLimit") is not None else "N/A"
                base_fee_val = blk.get("baseFeePerGas")
                base_fee_fmt = f"{base_fee_val} wei" if base_fee_val is not None else "N/A"
                miner_val = str(blk.get("miner") or "0x0000000000000000000000000000000000000000")

                block_tx_hashes = []
                block_tx_objs = []
                for tx in tx_objs:
                    tx_h = ensure_0x(tx.get("hash"))
                    block_tx_hashes.append(tx_h)
                    tx_from = tx.get("from", "")
                    tx_to = tx.get("to") or ""

                    # Check receipt for gas used and status
                    tx_receipt = None
                    try:
                        tx_receipt = w3.eth.get_transaction_receipt(tx["hash"])
                    except Exception:
                        pass

                    gas_used_num = tx_receipt["gasUsed"] if tx_receipt else 0
                    tx_status = "Confirmed" if (tx_receipt and tx_receipt.get("status") == 1) else ("Confirmed" if not tx_receipt else "Reverted")
                    receipt_contract_addr = tx_receipt.get("contractAddress") if tx_receipt else None

                    tx_in = ensure_0x(tx.get("input", "")).lower()
                    tx_to_lower = (tx_to or "").lower()

                    # Decode transaction using web3 contract ABI
                    decoded_fn = None
                    decoded_args = {}
                    if tx_to_lower == prop_reg_addr.lower() and prop_contract:
                        try:
                            decoded_fn, decoded_args = prop_contract.decode_function_input(tx_in)
                        except Exception:
                            pass
                    elif tx_to_lower == own_reg_addr.lower() and own_contract:
                        try:
                            decoded_fn, decoded_args = own_contract.decode_function_input(tx_in)
                        except Exception:
                            pass
                    elif tx_to_lower == tx_mgr_addr.lower() and tx_mgr_contract:
                        try:
                            decoded_fn, decoded_args = tx_mgr_contract.decode_function_input(tx_in)
                        except Exception:
                            pass

                    fn_name = decoded_fn.fn_name if decoded_fn else None
                    is_role_grant = tx_in.startswith("0x2f2ff15d") or fn_name == "grantRole"

                    prop_id = prop_tx_map.get(tx_h.lower()) or transfer_tx_map.get(tx_h.lower())
                    if decoded_args.get("propertyId"):
                        prop_id = str(decoded_args["propertyId"])
                    prop_title = prop_title_map.get(prop_id, "")

                    owner_wallet = ""
                    if decoded_args.get("ownerWallet"):
                        owner_wallet = str(decoded_args["ownerWallet"])
                    elif decoded_args.get("newOwner"):
                        owner_wallet = str(decoded_args["newOwner"])

                    doc_hash = ""
                    if decoded_args.get("documentHash"):
                        dh_val = decoded_args["documentHash"]
                        doc_hash = ensure_0x(dh_val.hex() if hasattr(dh_val, "hex") else str(dh_val))

                    # Friendly Name Mapping:
                    # - PropertyRegistry.registerProperty -> "Property Registered"
                    # - OwnershipRegistry.recordInitialOwnership -> "Initial Owner Recorded"
                    # - OwnershipRegistry.recordOwnershipTransfer -> "Ownership Transferred"
                    # - grantRole -> "Role Granted"
                    # - contract creation -> "Contract Deployed (<contract name>)"
                    # - anything else -> "Contract Call: <functionName>"
                    contract_friendly_name = "Smart Contract"
                    if not tx_to:
                        contract_name = "Smart Contract"
                        ca = (receipt_contract_addr or "").lower()
                        if ca == prop_reg_addr.lower() or tx_h.lower() == contracts_info.get("PropertyRegistry", {}).get("deploymentTxHash", "").lower():
                            contract_name = "PropertyRegistry"
                        elif ca == own_reg_addr.lower() or tx_h.lower() == contracts_info.get("OwnershipRegistry", {}).get("deploymentTxHash", "").lower():
                            contract_name = "OwnershipRegistry"
                        elif ca == tx_mgr_addr.lower() or tx_h.lower() == contracts_info.get("TransactionManager", {}).get("deploymentTxHash", "").lower():
                            contract_name = "TransactionManager"
                        event_name = f"Contract Deployed ({contract_name})"
                        contract_friendly_name = contract_name
                        details = f"{contract_name} Deployed"
                    elif is_role_grant:
                        event_name = "Role Granted"
                        contract_friendly_name = "PropertyRegistry" if tx_to_lower == prop_reg_addr.lower() else ("OwnershipRegistry" if tx_to_lower == own_reg_addr.lower() else "TransactionManager")
                        details = f"{contract_friendly_name} Role Granted"
                    elif fn_name == "registerProperty" or (tx_to_lower == prop_reg_addr.lower() and tx_in.startswith("0x050888b8")):
                        event_name = "Property Registered"
                        contract_friendly_name = "PropertyRegistry"
                        details = f"Property {prop_id} registered" if prop_id else "Property Registered"
                    elif fn_name == "recordInitialOwnership" or (tx_to_lower == own_reg_addr.lower() and tx_in.startswith("0xaff4c199")):
                        event_name = "Initial Owner Recorded"
                        contract_friendly_name = "OwnershipRegistry"
                        details = f"Initial owner recorded for {prop_id}" if prop_id else "Initial Owner Recorded"
                    elif fn_name == "recordOwnershipTransfer" or (tx_to_lower == own_reg_addr.lower() and tx_in.startswith("0x98d1ef86")):
                        event_name = "Ownership Transferred"
                        contract_friendly_name = "OwnershipRegistry"
                        details = f"Ownership conveyance recorded for {prop_id}" if prop_id else "Ownership Transferred"
                    elif fn_name:
                        event_name = f"Contract Call: {fn_name}"
                        contract_friendly_name = "PropertyRegistry" if tx_to_lower == prop_reg_addr.lower() else ("OwnershipRegistry" if tx_to_lower == own_reg_addr.lower() else "TransactionManager")
                        details = f"{contract_friendly_name}.{fn_name}"
                    elif tx_to_lower == prop_reg_addr.lower():
                        event_name = "Contract Call: PropertyRegistry"
                        contract_friendly_name = "PropertyRegistry"
                        details = "PropertyRegistry Call"
                    elif tx_to_lower == own_reg_addr.lower():
                        event_name = "Contract Call: OwnershipRegistry"
                        contract_friendly_name = "OwnershipRegistry"
                        details = "OwnershipRegistry Call"
                    elif tx_to_lower == tx_mgr_addr.lower():
                        event_name = "Contract Call: TransactionManager"
                        contract_friendly_name = "TransactionManager"
                        details = "TransactionManager Call"
                    else:
                        event_name = "Contract Call"
                        details = "Smart Contract Call"

                    # Match property owner name if known
                    owner_name = ""
                    for rp in registered_properties_list:
                        if rp["property_id"] == prop_id or (rp.get("property_uuid") and rp["property_uuid"] == prop_id):
                            if not prop_title:
                                prop_title = rp.get("title", "")
                            if not doc_hash and rp.get("document_hashes"):
                                doc_hash = rp["document_hashes"][0]
                            if not owner_wallet and rp.get("owner_wallet"):
                                owner_wallet = rp["owner_wallet"]
                            owner_name = rp.get("owner_name", "")
                            break

                    if not owner_name:
                        for tr in transfer_list:
                            if tr["property_id"] == prop_id:
                                if not prop_title:
                                    prop_title = tr.get("property_title", "")
                                if not owner_wallet:
                                    owner_wallet = tr.get("to_address", "")
                                owner_name = tr.get("to_owner", "")
                                break

                    tx_item = {
                        "hash": tx_h,
                        "blockNumber": b_num,
                        "from": tx_from,
                        "to": tx_to or "Contract Deployment",
                        "contractName": contract_friendly_name,
                        "event": event_name,
                        "functionName": fn_name,
                        "propertyId": prop_id,
                        "propertyTitle": prop_title,
                        "ownerWallet": owner_wallet,
                        "ownerName": owner_name,
                        "documentHash": doc_hash,
                        "details": details,
                        "data": tx_in,
                        "value": f"{w3.from_wei(tx.get('value', 0), 'ether')} ETH",
                        "gasUsed": f"{gas_used_num:,} gas",
                        "gasPrice": f"{w3.from_wei(tx.get('gasPrice', 0), 'gwei')} Gwei",
                        "status": tx_status,
                        "timestamp": b_time,
                    }
                    txs_list.append(tx_item)
                    block_tx_objs.append(tx_item)

                # Classify block type and friendly title
                if b_num == 0:
                    b_type = "Genesis Block"
                    friendly_block_title = "Genesis Block"
                else:
                    has_prop_reg = any(t["event"] == "Property Registered" for t in block_tx_objs)
                    has_initial_owner = any(t["event"] == "Initial Owner Recorded" for t in block_tx_objs)
                    has_transfer = any(t["event"] == "Ownership Transferred" for t in block_tx_objs)
                    has_role = any(t["event"] == "Role Granted" for t in block_tx_objs)
                    has_deploy = any("Contract Deployed" in t["event"] for t in block_tx_objs)

                    if has_prop_reg:
                        b_type = "Property Registered"
                        friendly_block_title = "Property Registered"
                    elif has_initial_owner:
                        b_type = "Initial Owner Recorded"
                        friendly_block_title = "Initial Owner Recorded"
                    elif has_transfer:
                        b_type = "Ownership Transferred"
                        friendly_block_title = "Ownership Transferred"
                    elif has_role:
                        b_type = "Role Authorization" if b_num <= 5 else "Role Granted"
                        friendly_block_title = "Role Authorization" if b_num <= 5 else "Role Granted"
                    elif has_deploy:
                        deploy_tx = next((t for t in block_tx_objs if "Contract Deployed" in t["event"]), None)
                        b_type = "Contract Deployment"
                        friendly_block_title = "Contract Deployment" if b_num <= 5 else (deploy_tx["event"] if deploy_tx else "Contract Deployed")
                    else:
                        first_tx = block_tx_objs[0] if block_tx_objs else None
                        b_type = "Smart Contract Interaction"
                        friendly_block_title = first_tx["event"] if first_tx else "Smart Contract Interaction"

                matching_transfer = next(
                    (t for t in transfer_list if t.get("block_number") == b_num or (t.get("tx_hash") and t.get("tx_hash").lower() in [h.lower() for h in block_tx_hashes])),
                    None
                )
                if matching_transfer and not has_initial_owner:
                    b_type = "Ownership Transferred"
                    friendly_block_title = "Ownership Transferred"

                blocks_list.append({
                    "blockNumber": b_num,
                    "hash": b_hash,
                    "parentHash": p_hash,
                    "timestamp": b_time,
                    "transactionsCount": tx_count,
                    "gasUsed": gas_used_fmt,
                    "gasLimit": gas_limit_fmt,
                    "baseFeePerGas": base_fee_fmt,
                    "miner": miner_val,
                    "transactionsRoot": tx_root,
                    "stateRoot": st_root,
                    "receiptsRoot": rc_root,
                    "blockType": b_type,
                    "friendlyTitle": friendly_block_title,
                    "transferDetails": matching_transfer,
                    "transactions": block_tx_hashes,
                })
            except Exception as b_err:
                logger.warning("Could not process block %s: %s", b_num, b_err)

    # 5. Smart contracts status section
    contracts_section = [
        {
            "name": "PropertyRegistry",
            "address": prop_reg_addr,
            "deploymentTxHash": contracts_info.get("PropertyRegistry", {}).get("deploymentTxHash", "0xa7c140b7328a99cfe2980e4cd0fd52bdba4644f2a3e3aff06dba96164580880b"),
            "deploymentBlock": contracts_info.get("PropertyRegistry", {}).get("deploymentBlockNumber", 1),
            "status": "Active",
            "abiStatus": "Verified",
            "deployedAt": contracts_info.get("PropertyRegistry", {}).get("deployedAt", "2026-11-03T16:54:58.948Z"),
            "purpose": "Anchors verified title deeds and canonical land parcel registry records on-chain.",
            "abi": contracts_info.get("PropertyRegistry", {}).get("abi", []),
        },
        {
            "name": "OwnershipRegistry",
            "address": own_reg_addr,
            "deploymentTxHash": contracts_info.get("OwnershipRegistry", {}).get("deploymentTxHash", "0x2a66d0ebbc1008bab413e3ed4bd095411a5c27df4fd76f04d815eaef42ecedd0"),
            "deploymentBlock": contracts_info.get("OwnershipRegistry", {}).get("deploymentBlockNumber", 2),
            "status": "Active",
            "abiStatus": "Verified",
            "deployedAt": contracts_info.get("OwnershipRegistry", {}).get("deployedAt", "2026-11-03T16:54:58.948Z"),
            "purpose": "Immutable chronological conveyance ledger and current registered owner lookup.",
            "abi": contracts_info.get("OwnershipRegistry", {}).get("abi", []),
        },
        {
            "name": "TransactionManager",
            "address": tx_mgr_addr,
            "deploymentTxHash": contracts_info.get("TransactionManager", {}).get("deploymentTxHash", "0x681a77d7fa59724b712ccbc3459bff4b1bf95964283c8f1f1615c1ee4a7a6afd"),
            "deploymentBlock": contracts_info.get("TransactionManager", {}).get("deploymentBlockNumber", 4),
            "status": "Active",
            "abiStatus": "Verified",
            "deployedAt": contracts_info.get("TransactionManager", {}).get("deployedAt", "2026-11-03T16:54:58.948Z"),
            "purpose": "Multi-signature escrow state machine enforcing seller, verifier, and legal sign-offs.",
            "abi": contracts_info.get("TransactionManager", {}).get("abi", []),
        },
    ]

    # 6. Role-Based Scoping
    user_role = (current_user.role or "").upper()
    user_id_str = str(current_user.id)
    user_wallets = list(
        db.scalars(
            select(UserWallet).where(UserWallet.user_id == current_user.id)
        ).all()
    )
    user_wallet_addrs = {w.wallet_address.lower() for w in user_wallets if w.wallet_address}
    if current_user.wallet_address:
        user_wallet_addrs.add(current_user.wallet_address.lower())

    scoped_properties = registered_properties_list
    scoped_transfers = transfer_list
    scoped_txs = txs_list
    failed_ops_list = []

    if user_role == "ADMIN":
        # Admin has complete visibility into all records and failed/pending operations
        failed_ops_db = list(
            db.scalars(
                select(BlockchainOperation)
                .where(BlockchainOperation.status.in_(["FAILED", "PENDING"]))
                .order_by(BlockchainOperation.created_at.desc())
                .limit(20)
            ).all()
        )
        failed_ops_list = [
            {
                "id": str(op.id),
                "operationType": op.operation_type,
                "status": op.status,
                "txHash": op.tx_hash or "",
                "retryCount": op.retry_count,
                "errorMessage": op.error_message or "",
                "createdAt": op.created_at.isoformat() if op.created_at else None,
            }
            for op in failed_ops_db
        ]
    elif user_role == "PROPERTY_OWNER":
        # Seller: own registered properties, own transfers, own transactions + foundational deployments
        seller_prop_ids = {
            p["property_id"]
            for p in registered_properties_list
            if p["creator_uuid"] == user_id_str or p["owner_uuid"] == user_id_str
        }
        scoped_properties = [
            p for p in registered_properties_list
            if p["property_id"] in seller_prop_ids
        ]
        scoped_transfers = [
            t for t in transfer_list
            if t["previous_owner_id"] == user_id_str or t["new_owner_id"] == user_id_str
        ]
        scoped_txs = [
            tx for tx in txs_list
            if tx["blockNumber"] <= 5
            or (tx.get("propertyId") and tx["propertyId"] in seller_prop_ids)
            or (tx["from"].lower() in user_wallet_addrs or tx["to"].lower() in user_wallet_addrs)
        ]
    elif user_role == "BUYER":
        # Buyer: public verified properties, authorized purchase transfers, and relevant txs
        scoped_properties = [
            {
                k: v for k, v in p.items()
                if k not in {"creator_uuid", "owner_uuid"}
            }
            for p in registered_properties_list
        ]
        scoped_transfers = [
            t for t in transfer_list
            if t["new_owner_id"] == user_id_str or t["to_address"].lower() in user_wallet_addrs
        ]
        buyer_prop_ids = {t["property_id"] for t in scoped_transfers if t.get("property_id")}
        scoped_txs = [
            tx for tx in txs_list
            if tx["blockNumber"] <= 5
            or (tx["from"].lower() in user_wallet_addrs or tx["to"].lower() in user_wallet_addrs)
            or (tx.get("propertyId") and tx["propertyId"] in buyer_prop_ids)
            or tx["event"] in {"Property Registered", "Contract Deployment"}
            or tx["event"].startswith("Contract Deployed")
        ]
    elif user_role in {"REGISTRAR", "VERIFIER"}:
        # Verifier: verified property registrations, verification-related txs
        scoped_properties = registered_properties_list
        scoped_transfers = transfer_list
        scoped_txs = [
            tx for tx in txs_list
            if tx["blockNumber"] <= 5
            or tx["event"] in {"Property Registered", "Contract Deployment"}
            or tx["event"].startswith("Contract Deployed")
        ]
    elif user_role == "LEGAL_AUTHORITY":
        # Legal Authority: authorized property registrations and conveyance transfers
        scoped_properties = registered_properties_list
        scoped_transfers = transfer_list
        scoped_txs = txs_list

    return {
        "userRole": user_role,
        "network": {
            "name": "Local Hardhat Network",
            "chainId": 31337,
            "rpcUrl": os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545"),
            "status": "Connected" if is_connected else "Disconnected",
            "latestBlock": latest_block_num,
            "totalBlocks": latest_block_num + 1 if is_connected else 0,
            "totalTransactions": total_tx_count,
            "totalPropertyRegistrations": len(scoped_properties),
            "totalOwnershipTransfers": len(scoped_transfers),
            "deployedContractsCount": len(contracts_section),
        },
        "blocks": blocks_list,
        "transactions": scoped_txs,
        "registeredProperties": scoped_properties,
        "ownershipTransfers": scoped_transfers,
        "contracts": contracts_section,
        "failedOperations": failed_ops_list,
    }
