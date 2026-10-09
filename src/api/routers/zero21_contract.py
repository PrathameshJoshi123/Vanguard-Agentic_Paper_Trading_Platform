from datetime import datetime, timezone
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from src.common.types import Side, OrderType, OrderStatus, ProductType, TimeInForce
from src.common.money import to_money
from src.common.exceptions import (
    InsufficientMarginError,
    InsufficientHoldingsError,
    InvalidOrderError,
    OrderNotFoundError,
)
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.market_data.zero21.config import zero21_config
from src.market_data.zero21.instruments import instrument_master

logger = logging.getLogger(__name__)

# Router for 021 Developer Sandbox API contract
router = APIRouter(tags=["021 Trade Contract"])

# Counter for numeric order and trade IDs expected by 021 harness
_order_id_counter = 1000
_trade_id_counter = 5000


def _next_numeric_order_id() -> int:
    global _order_id_counter
    _order_id_counter += 1
    return _order_id_counter


def _resolve_account_id(auth_header: Optional[str] = None) -> str:
    """Extracts account ID or UCC client code from Authorization header or config."""
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        # If token is like UCC (e.g. HACK1234), use it
        if token.startswith("HACK"):
            return token
    return zero21_config.ucc or "HACK1234"


def _ensure_account_funded(trade_service: TradeExecutionService, account_id: str) -> None:
    """Ensures virtual trading account has ₹10,00,000 (10 Lakhs) virtual funds."""
    if account_id not in trade_service._accounts:
        trade_service.register_account(account_id, initial_deposit=Decimal("1000000.00"))


# ============================================================================
# Request & Response Models (Strict 021 Hackathon Specification)
# ============================================================================

class Zero21Envelope(BaseModel):
    data: Optional[Any] = None
    success: bool
    error: Optional[str] = None


class Zero21OrderPlaceRequest(BaseModel):
    exchange: str = "NSE"
    token: int
    qty: int  # Positive = BUY, Negative = SELL
    price: int = 0  # In paise. 0 = Market order
    book: str = "RL"  # RL (Regular) or SL (Stop-Loss)
    product: str = "INTRADAY"  # INTRADAY, CNC, NRML
    validity: str = "Day"  # Day or IOC
    trigger: Optional[int] = 0  # Trigger in paise for SL
    discQuantity: Optional[int] = 0
    amo: Optional[bool] = False


class Zero21OrderModifyRequest(BaseModel):
    exchange: Optional[str] = "NSE"
    token: Optional[int] = None
    qty: Optional[int] = None
    price: Optional[int] = None
    book: Optional[str] = "RL"
    product: Optional[str] = "INTRADAY"
    validity: Optional[str] = "Day"
    trigger: Optional[int] = 0
    discQuantity: Optional[int] = 0
    amo: Optional[bool] = False


class Zero21OrderCancelRequest(BaseModel):
    exchange: Optional[str] = "NSE"
    token: Optional[int] = None
    product: Optional[str] = "INTRADAY"


class Zero21OrderResponse(BaseModel):
    orderId: Union[int, str]
    time: int
    lastActivity: int
    token: int
    exchange: str
    product: str
    qtyRemaining: int
    qtyTraded: int
    discQty: int
    price: int  # In paise
    triggerPrice: int  # In paise
    book: str
    validity: str
    status: str  # Received, Placed, Pending, Executed, Rejected, Cancelled
    reason: str
    placedBy: str
    amo: bool
    exchangeOrderNumber: str


class Zero21TradeResponse(BaseModel):
    tradeId: int
    tradeTime: int
    quantity: int  # Positive = bought, negative = sold
    token: int
    exchange: str
    product: str
    price: int  # Fill price in paise
    symbol: str


class Zero21PositionResponse(BaseModel):
    exchange: str
    token: int
    product: str
    netQuantity: int
    netPrice: int  # In paise
    carryForwardQuantity: int
    longPosition: bool
    squareOffQuantity: int
    buyPrice: int  # In paise
    sellPrice: int  # In paise
    prevClose: int  # In paise


class Zero21HoldingResponse(BaseModel):
    isin: str
    symbol: str
    freeQty: int
    btstQty: int
    sellQty: int
    price: int  # In paise
    prevClose: int  # In paise


# ============================================================================
# 021 REST API Endpoints
# ============================================================================

@router.post("/auth/token", response_model=Zero21Envelope)
def zero21_auth_token(req: Dict[str, Any]):
    """
    Simulated 021 auth endpoint so the test harness can authenticate against this engine.
    """
    username = req.get("username", "HACK1234")
    return Zero21Envelope(
        data={
            "accessToken": f"bearer_{username}_{int(datetime.now(timezone.utc).timestamp())}",
            "tokenType": "Bearer",
            "expiresAt": "2026-10-10T05:00:00+05:30",
            "expiresIn": 39600,
        },
        success=True,
        error=None,
    )


@router.get("/websocket/ephemeral-key", response_model=Zero21Envelope)
def zero21_ephemeral_key():
    """
    Simulated 021 ephemeral key endpoint.
    """
    return Zero21Envelope(
        data={"token": "mock_ephemeral_key_24h"},
        success=True,
        error=None,
    )


@router.get("/instruments")
def zero21_get_instruments():
    """
    Returns instruments CSV (compressed or raw text/csv) matching 021 format.
    """
    from pathlib import Path
    cache_path = Path(zero21_config.instruments_cache_path)
    if cache_path.exists():
        content = cache_path.read_bytes()
    else:
        # Generate seed CSV
        header = (
            "token,exchange,underlying_token,underlying_exchange,min_lot_size,board_lot_quantity,"
            "freeze_quantity,lower_circuit,upper_circuit,expiry,option_type,strike_price,symbol,"
            "instrument_type,isin,ticksize\n"
        )
        rows = [
            f"{i.token},{i.exchange},{i.underlying_token},{i.underlying_exchange},{i.min_lot_size},"
            f"{i.board_lot_quantity},{i.freeze_quantity},{i.lower_circuit},{i.upper_circuit},{i.expiry},"
            f"{i.option_type},{i.strike_price},{i.symbol},{i.instrument_type},{i.isin},{i.ticksize}\n"
            for i in instrument_master._by_token.values()
        ]
        content = (header + "".join(rows)).encode("utf-8")

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=instruments.csv"},
    )



@router.post("/orders", response_model=Zero21Envelope)
def place_order_zero21(
    req: Zero21OrderPlaceRequest,
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    021 Place Order API: Accepts orders in paise & token units.
    Executes simulated trading in-memory and returns 021 envelope.
    """
    account_id = _resolve_account_id(authorization)
    _ensure_account_funded(trade_service, account_id)

    if req.qty == 0:
        return Zero21Envelope(data=None, success=False, error="Order quantity cannot be zero.")

    # 1. Resolve Instrument
    inst = instrument_master.get_by_token(req.token)
    symbol = inst.symbol if inst else (instrument_master.token_to_symbol(req.token) or f"TOKEN_{req.token}")

    # Risk rule checks: tick size and circuits
    if inst and req.price > 0:
        if inst.ticksize > 0 and (req.price % inst.ticksize) != 0:
            return Zero21Envelope(
                data=None,
                success=False,
                error=f"Price {req.price} is not a multiple of tick size {inst.ticksize} paise.",
            )
        if inst.lower_circuit > 0 and inst.upper_circuit > 0:
            if req.price < inst.lower_circuit or req.price > inst.upper_circuit:
                return Zero21Envelope(
                    data=None,
                    success=False,
                    error=f"Price {req.price} outside circuit limits [{inst.lower_circuit}, {inst.upper_circuit}].",
                )

    # 2. Side & Quantity
    side = Side.BUY if req.qty > 0 else Side.SELL
    quantity = abs(req.qty)

    # 3. Product Type
    prod_str = req.product.upper()
    product_type = ProductType.CNC if prod_str == "CNC" else ProductType.MIS

    # 4. Order Type & Pricing (Convert paise to Decimal Rupees)
    price_dec = to_money(Decimal(req.price) / Decimal("100")) if req.price > 0 else Decimal("0.00")
    trigger_dec = to_money(Decimal(req.trigger or 0) / Decimal("100")) if (req.trigger or 0) > 0 else None

    book_str = req.book.upper()
    if book_str == "SL":
        order_type = OrderType.SL if req.price > 0 else OrderType.SL_M
    else:
        order_type = OrderType.LIMIT if req.price > 0 else OrderType.MARKET

    order_id_num = _next_numeric_order_id()
    order_id_str = str(order_id_num)

    try:
        domain_order = Order(
            order_id=order_id_str,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price_dec,
            trigger_price=trigger_dec,
            product_type=product_type,
            time_in_force=TimeInForce.IOC if req.validity.upper() == "IOC" else TimeInForce.DAY,
            account_id=account_id,
            status=OrderStatus.PENDING,
        )
        # Store metadata attributes on order for 021 serialization
        setattr(domain_order, "token", req.token)
        setattr(domain_order, "exchange", inst.exchange if inst else "NSECM")
        setattr(domain_order, "book", req.book)
        setattr(domain_order, "validity", req.validity)
        setattr(domain_order, "amo", req.amo or False)

        result = trade_service.place_order(domain_order)
    except (InsufficientMarginError, InsufficientHoldingsError) as e:
        return Zero21Envelope(data=None, success=False, error=f"Insufficient funds: {e}")
    except InvalidOrderError as e:
        return Zero21Envelope(data=None, success=False, error=str(e))
    except Exception as e:
        logger.exception("Error executing order in paper engine:")
        return Zero21Envelope(data=None, success=False, error=str(e))

    return Zero21Envelope(
        data={
            "type": "SUCCESS",
            "message": "Order placed successfully",
            "orderId": order_id_str,
        },
        success=True,
        error=None,
    )


@router.put("/orders/{order_id}", response_model=Zero21Envelope)
def modify_order_zero21(
    order_id: str,
    req: Zero21OrderModifyRequest,
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 Modify Order API."""
    existing_order = trade_service.get_order(order_id)
    if not existing_order:
        return Zero21Envelope(data=None, success=False, error=f"Order {order_id} not found.")

    account_id = _resolve_account_id(authorization) or existing_order.account_id

    new_qty = abs(req.qty) if (req.qty is not None and req.qty != 0) else None
    new_price = to_money(Decimal(req.price) / Decimal("100")) if (req.price is not None and req.price > 0) else None

    # Resolve symbol from token or existing order
    inst = instrument_master.get_by_token(req.token) if req.token else None
    symbol = inst.symbol if inst else existing_order.symbol

    try:
        trade_service.modify_order(
            account_id=account_id,
            order_id=order_id,
            symbol=symbol,
            new_quantity=new_qty,
            new_price=new_price,
        )
    except OrderNotFoundError:
        return Zero21Envelope(data=None, success=False, error=f"Order {order_id} not found.")
    except Exception as e:
        return Zero21Envelope(data=None, success=False, error=str(e))

    return Zero21Envelope(
        data={"type": "SUCCESS", "message": "Order modified successfully"},
        success=True,
        error=None,
    )


@router.delete("/orders/{order_id}", response_model=Zero21Envelope)
def cancel_order_zero21(
    order_id: str,
    req: Optional[Zero21OrderCancelRequest] = None,
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 Cancel Order API."""
    account_id = _resolve_account_id(authorization)
    order = trade_service.get_order(order_id)
    if not order:
        return Zero21Envelope(data=None, success=False, error=f"Order {order_id} not found.")

    try:
        trade_service.cancel_order(
            account_id=account_id,
            order_id=order_id,
            symbol=order.symbol,
        )
    except Exception as e:
        return Zero21Envelope(data=None, success=False, error=str(e))

    return Zero21Envelope(
        data={"type": "SUCCESS", "message": "Order cancelled successfully"},
        success=True,
        error=None,
    )


def _serialize_zero21_order(order: Order) -> Zero21OrderResponse:
    token = getattr(order, "token", None) or instrument_master.symbol_to_token(order.symbol) or 2885
    exchange = getattr(order, "exchange", "NSECM")
    book = getattr(order, "book", "RL")
    validity = getattr(order, "validity", "Day")
    amo = getattr(order, "amo", False)

    price_paise = int(order.price * 100) if order.price else 0
    trigger_paise = int(order.trigger_price * 100) if order.trigger_price else 0

    # Signed remaining quantity (+ for buy, - for sell)
    remaining_signed = order.remaining_qty if order.side == Side.BUY else -order.remaining_qty

    # Status mapping to 021 status strings
    status_map = {
        OrderStatus.PENDING: "Pending",
        OrderStatus.OPEN: "Placed",
        OrderStatus.PARTIALLY_FILLED: "Pending",
        OrderStatus.FILLED: "Executed",
        OrderStatus.CANCELLED: "Cancelled",
        OrderStatus.REJECTED: "Rejected",
        OrderStatus.TRIGGER_PENDING: "Pending",
    }
    status_str = status_map.get(order.status, "Pending")

    created_ts = int(order.created_at.timestamp())
    updated_ts = int(order.updated_at.timestamp()) if order.updated_at else created_ts

    try:
        oid: Union[int, str] = int(order.order_id)
    except ValueError:
        oid = order.order_id

    return Zero21OrderResponse(
        orderId=oid,
        time=created_ts,
        lastActivity=updated_ts,
        token=token,
        exchange=exchange,
        product="INTRADAY" if order.product_type == ProductType.MIS else "CNC",
        qtyRemaining=remaining_signed,
        qtyTraded=order.filled_qty,
        discQty=0,
        price=price_paise,
        triggerPrice=trigger_paise,
        book=book,
        validity=validity,
        status=status_str,
        reason="",
        placedBy="User",
        amo=amo,
        exchangeOrderNumber=f"11000000{order.order_id[-8:]}" if len(order.order_id) >= 8 else f"11000000{order.order_id}",
    )


@router.get("/orders", response_model=List[Zero21OrderResponse])
def get_orders_zero21(
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 List Today's Orders API (Plain JSON Array, newest first)."""
    account_id = _resolve_account_id(authorization)
    orders = trade_service.get_orders(account_id)
    # Newest first
    sorted_orders = sorted(orders, key=lambda o: o.created_at, reverse=True)
    return [_serialize_zero21_order(o) for o in sorted_orders]


@router.get("/orders/{order_id}", response_model=List[Zero21OrderResponse])
def get_single_order_zero21(
    order_id: str,
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    021 Get Single Order API: returns 1-element array or 404.
    """
    order = trade_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found")
    return [_serialize_zero21_order(order)]


@router.get("/trades", response_model=List[Zero21TradeResponse])
def get_trades_zero21(
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 List Today's Trades API (Plain JSON Array)."""
    account_id = _resolve_account_id(authorization)
    trades = trade_service.get_trades(account_id)
    res: List[Zero21TradeResponse] = []

    for t in trades:
        token = instrument_master.symbol_to_token(t.symbol) or 2885
        qty_signed = t.quantity if t.side == Side.BUY else -t.quantity
        price_paise = int(t.price * 100)
        ts = int(t.timestamp.timestamp())
        try:
            tid = int(t.trade_id.replace("TRD-", ""))
        except ValueError:
            tid = 5001

        res.append(
            Zero21TradeResponse(
                tradeId=tid,
                tradeTime=ts,
                quantity=qty_signed,
                token=token,
                exchange="NSECM",
                product="INTRADAY",
                price=price_paise,
                symbol=t.symbol,
            )
        )
    return sorted(res, key=lambda tr: tr.tradeTime, reverse=True)


@router.get("/orders/{order_id}/trades", response_model=List[Zero21TradeResponse])
def get_order_trades_zero21(
    order_id: str,
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 List Trades of One Order API."""
    account_id = _resolve_account_id(authorization)
    trades = [t for t in trade_service.get_trades(account_id) if t.order_id == order_id]
    res: List[Zero21TradeResponse] = []

    for t in trades:
        token = instrument_master.symbol_to_token(t.symbol) or 2885
        qty_signed = t.quantity if t.side == Side.BUY else -t.quantity
        price_paise = int(t.price * 100)
        ts = int(t.timestamp.timestamp())
        try:
            tid = int(t.trade_id.replace("TRD-", ""))
        except ValueError:
            tid = 5001

        res.append(
            Zero21TradeResponse(
                tradeId=tid,
                tradeTime=ts,
                quantity=qty_signed,
                token=token,
                exchange="NSECM",
                product="INTRADAY",
                price=price_paise,
                symbol=t.symbol,
            )
        )
    return res


@router.get("/portfolio/positions", response_model=List[Zero21PositionResponse])
def get_positions_zero21(
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 Positions API (Plain JSON Array)."""
    account_id = _resolve_account_id(authorization)
    positions = trade_service.position_manager.get_positions(account_id)
    res: List[Zero21PositionResponse] = []

    for pos in positions:
        token = instrument_master.symbol_to_token(pos.symbol) or 2885
        prod_str = "INTRADAY" if pos.product_type == ProductType.MIS else "CNC"
        net_price_paise = int(pos.average_price * 100) if pos.average_price else 0

        res.append(
            Zero21PositionResponse(
                exchange="NSECM",
                token=token,
                product=prod_str,
                netQuantity=pos.quantity,
                netPrice=net_price_paise,
                carryForwardQuantity=0,
                longPosition=pos.quantity > 0,
                squareOffQuantity=-pos.quantity,
                buyPrice=net_price_paise if pos.quantity > 0 else 0,
                sellPrice=net_price_paise if pos.quantity < 0 else 0,
                prevClose=net_price_paise,
            )
        )
    return res


@router.get("/portfolio/holdings", response_model=List[Zero21HoldingResponse])
def get_holdings_zero21(
    authorization: Optional[str] = Header(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """021 Holdings API (Plain JSON Array)."""
    account_id = _resolve_account_id(authorization)
    holdings = trade_service.position_manager.get_holdings(account_id)
    res: List[Zero21HoldingResponse] = []

    for h in holdings:
        inst = instrument_master.get_by_symbol(h.symbol)
        isin = inst.isin if inst else "INE002A01018"
        price_paise = int(h.average_buy_price * 100) if h.average_buy_price else 0
        prev_close_paise = int(h.current_price * 100) if h.current_price else price_paise

        res.append(
            Zero21HoldingResponse(
                isin=isin,
                symbol=h.symbol,
                freeQty=h.quantity,
                btstQty=0,
                sellQty=0,
                price=price_paise,
                prevClose=prev_close_paise,
            )
        )
    return res
