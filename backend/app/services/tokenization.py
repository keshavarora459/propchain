"""
Shared Tokenization Economics & Purchase Mode Utilities for PropChain.
Parses tokenized property metadata cleanly across MongoDB-synced entities and calculates
real-time token availability and transaction ownership shares.
"""
import re
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.property import Property
from app.models.transaction import PropertyTransaction

_SYMBOL_RE = re.compile(r"Symbol:\s*([A-Za-z0-9_-]+)", re.IGNORECASE)
_SUPPLY_RE = re.compile(r"Total\s+Supply:\s*([\d,]+)", re.IGNORECASE)
_PRICE_RE = re.compile(r"Token\s+Price:\s*\$?([\d,]+(?:\.\d+)?)", re.IGNORECASE)
_MIN_PURCHASE_RE = re.compile(r"Min(?:imum)?\s+Purchase:\s*([\d,]+)", re.IGNORECASE)
_APY_RE = re.compile(r"Projected\s+APY:\s*([\d.]+)%?", re.IGNORECASE)


def normalize_purchase_mode(raw_mode: Optional[str], transaction_type: Optional[str] = None, token_quantity: Optional[int] = None) -> str:
    """Normalize incoming purchase mode / transaction type into TOKEN_PURCHASE or ENTIRE_PROPERTY."""
    mode = (raw_mode or "").upper().strip()
    if mode in {"TOKEN", "TOKENS", "FRACTIONAL", "TOKEN_PURCHASE", "FRACTIONAL_TOKEN"}:
        return "TOKEN_PURCHASE"
    if mode in {"ENTIRE", "WHOLE", "FULL", "ENTIRE_PROPERTY", "WHOLE_PROPERTY", "FULL_BUYOUT"}:
        return "ENTIRE_PROPERTY"

    txn_type = (transaction_type or "").upper().strip()
    if txn_type in {"TOKEN_PURCHASE", "FRACTIONAL", "TOKEN"}:
        return "TOKEN_PURCHASE"
    if token_quantity is not None and int(token_quantity) > 0:
        return "TOKEN_PURCHASE"
    return "ENTIRE_PROPERTY"


def parse_property_tokenomics(prop: Optional[Property]) -> Dict[str, Any]:
    """Extract tokenization parameters from a Property ORM instance."""
    if prop is None:
        return {
            "is_tokenized": False,
            "token_symbol": None,
            "total_tokens": None,
            "token_price": None,
            "min_tokens_per_buyer": None,
            "projected_apy": None,
        }

    cat = (prop.property_category or "").upper().strip()
    desc = prop.description or ""
    is_tokenized = cat == "TOKENIZED" or "[TOKENIZED" in desc.upper()

    if not is_tokenized:
        return {
            "is_tokenized": False,
            "token_symbol": None,
            "total_tokens": None,
            "token_price": None,
            "min_tokens_per_buyer": None,
            "projected_apy": None,
        }

    sym_m = _SYMBOL_RE.search(desc)
    sup_m = _SUPPLY_RE.search(desc)
    prc_m = _PRICE_RE.search(desc)
    min_m = _MIN_PURCHASE_RE.search(desc)
    apy_m = _APY_RE.search(desc)

    token_symbol = sym_m.group(1).upper() if sym_m else "PROP-TKN"
    total_tokens = int(sup_m.group(1).replace(",", "")) if sup_m else 1000
    if total_tokens <= 0:
        total_tokens = 1000

    valuation_val = float(prop.valuation) if prop.valuation is not None else 0.0
    if prc_m:
        token_price = float(prc_m.group(1).replace(",", ""))
    elif valuation_val > 0 and total_tokens > 0:
        token_price = round(valuation_val / total_tokens, 2)
    else:
        token_price = 100.0

    min_tokens_per_buyer = int(min_m.group(1).replace(",", "")) if min_m else 1
    if min_tokens_per_buyer <= 0:
        min_tokens_per_buyer = 1
    if min_tokens_per_buyer > total_tokens:
        min_tokens_per_buyer = total_tokens

    projected_apy = float(apy_m.group(1)) if apy_m else None

    return {
        "is_tokenized": True,
        "token_symbol": token_symbol,
        "total_tokens": total_tokens,
        "token_price": token_price,
        "min_tokens_per_buyer": min_tokens_per_buyer,
        "projected_apy": projected_apy,
    }


def compute_property_token_stats(db: Session, prop: Optional[Property]) -> Dict[str, Any]:
    """Compute live tokens sold, tokens in active escrow, and remaining available tokens."""
    base = parse_property_tokenomics(prop)
    if not base["is_tokenized"] or prop is None:
        return {
            **base,
            "tokens_sold": 0,
            "tokens_pending": 0,
            "available_tokens": None,
            "sold_as_whole": False,
        }

    total_tokens = int(base["total_tokens"] or 0)
    txns = list(
        db.scalars(
            select(PropertyTransaction).where(PropertyTransaction.property_id == prop.id)
        ).all()
    )

    tokens_sold = 0
    tokens_pending = 0
    sold_as_whole = False

    for txn in txns:
        st = (txn.status or "").upper().strip()
        mode = normalize_purchase_mode(
            getattr(txn, "purchase_mode", None),
            txn.transaction_type,
            getattr(txn, "token_quantity", None),
        )
        qty = getattr(txn, "token_quantity", None)

        if st == "COMPLETED":
            if mode == "ENTIRE_PROPERTY":
                sold_as_whole = True
                tokens_sold = total_tokens
            else:
                tokens_sold += int(qty or 0)
        elif st not in {"CANCELLED", "REJECTED", "FAILED"}:
            if mode == "TOKEN_PURCHASE":
                tokens_pending += int(qty or 0)

    if tokens_sold > total_tokens:
        tokens_sold = total_tokens
    available_tokens = max(0, total_tokens - tokens_sold)

    return {
        **base,
        "tokens_sold": tokens_sold,
        "tokens_pending": tokens_pending,
        "available_tokens": available_tokens,
        "sold_as_whole": sold_as_whole,
    }


def resolve_txn_token_meta(txn: PropertyTransaction, prop: Optional[Property] = None) -> Dict[str, Any]:
    """Resolve display/API tokenization fields for a PropertyTransaction."""
    target_prop = prop or getattr(txn, "property", None)
    prop_meta = parse_property_tokenomics(target_prop)
    is_prop_tokenized = bool(prop_meta["is_tokenized"])

    raw_qty = getattr(txn, "token_quantity", None)
    mode = normalize_purchase_mode(
        getattr(txn, "purchase_mode", None),
        txn.transaction_type,
        raw_qty,
    )

    raw_pct = getattr(txn, "ownership_percentage", None)
    if raw_pct is not None:
        ownership_pct = round(float(raw_pct), 4)
    elif mode == "TOKEN_PURCHASE" and raw_qty and prop_meta.get("total_tokens"):
        ownership_pct = round((int(raw_qty) / int(prop_meta["total_tokens"])) * 100.0, 4)
    else:
        ownership_pct = 100.0

    token_symbol = prop_meta["token_symbol"] if is_prop_tokenized else None
    if mode == "TOKEN_PURCHASE" and not token_symbol:
        token_symbol = "PROP-TKN"

    token_quantity = int(raw_qty) if raw_qty is not None else (
        int(prop_meta["total_tokens"]) if (mode == "ENTIRE_PROPERTY" and is_prop_tokenized and prop_meta.get("total_tokens")) else None
    )

    return {
        "purchase_mode": mode,
        "token_quantity": token_quantity,
        "token_symbol": token_symbol,
        "ownership_percentage": ownership_pct,
        "property_is_tokenized": is_prop_tokenized,
    }


def build_tokenized_description(
    base_description: Optional[str],
    token_symbol: str,
    total_tokens: int,
    token_price: float,
    min_tokens_per_buyer: int,
    projected_apy: Optional[float],
) -> str:
    """Format canonical tokenized description tag matching frontend convention."""
    apy_val = projected_apy if projected_apy is not None else 0
    notes = (base_description or "Fractionalized real estate asset offering for multiple investors.").strip()
    return (
        f"[TOKENIZED SALE] Symbol: {token_symbol.upper()} | "
        f"Total Supply: {total_tokens:,} tokens | "
        f"Token Price: ${token_price:g} | "
        f"Min Purchase: {min_tokens_per_buyer} tokens | "
        f"Projected APY: {apy_val:g}% | {notes}"
    )

