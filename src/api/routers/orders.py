from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.common.types import OrderStatus
from src.common.exceptions import (
    InsufficientMarginError,
    InsufficientHoldingsError,
    InvalidOrderError,
    OrderNotFoundError,
)
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.api.schemas.orders import (
    OrderCreate,
    OrderModify,
    OrderResponse,
    TradeResponse,
    OrderPlacementResponse,
)

router = APIRouter(prefix="/orders", tags=["Orders"])


def _to_order_response(order: Order) -> OrderResponse:
    return OrderResponse(
        order_id=order.order_id,
        account_id=order.account_id,
        symbol=order.symbol,
        side=order.side,
        order_type=order.order_type,
        product_type=order.product_type,
        quantity=order.quantity,
        price=order.price,
        trigger_price=order.trigger_price,
        time_in_force=order.time_in_force,
        status=order.status,
        filled_qty=order.filled_qty,
        remaining_qty=order.remaining_qty,
        average_fill_price=order.average_fill_price,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.post("", response_model=OrderPlacementResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    req: OrderCreate,
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Submits a new order to the deterministic in-memory trading engine.
    Pre-trade margin validated in RAM, matched in RAM, ledger debited in RAM.
    Ultra-low latency (<5ms).
    """
    order_id = f"ORD_{uuid.uuid4().hex[:10]}"
    try:
        domain_order = Order(
            order_id=order_id,
            symbol=req.symbol.upper(),
            side=req.side,
            order_type=req.order_type,
            quantity=req.quantity,
            price=req.price,
            trigger_price=req.trigger_price,
            product_type=req.product_type,
            time_in_force=req.time_in_force,
            account_id=req.account_id,
            status=OrderStatus.PENDING,
        )
        result = trade_service.place_order(domain_order)
    except (InsufficientMarginError, InsufficientHoldingsError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InvalidOrderError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    trade_responses = [
        TradeResponse(
            trade_id=t.trade_id,
            order_id=t.order_id,
            symbol=t.symbol,
            side=t.side,
            price=t.price,
            quantity=t.quantity,
            counterparty_order_id=t.counterparty_order_id,
            is_maker=t.is_maker,
            timestamp=t.timestamp,
        )
        for t in result.match_result.trade_events
        if t.order_id == result.order.order_id
    ]

    total_charges = sum((c.total_charges for c in result.trade_charges), Decimal("0.00"))

    return OrderPlacementResponse(
        order=_to_order_response(result.order),
        trades=trade_responses,
        total_charges=total_charges,
        account_balance=result.account_running_balance,
    )


@router.patch("/{order_id}", response_model=OrderResponse)
def modify_order(
    order_id: str,
    req: OrderModify,
    account_id: str = Query(default="DEFAULT"),
    symbol: str = Query(..., description="Order instrument symbol"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Modifies quantity and/or price of a resting limit order.
    """
    try:
        modified = trade_service.modify_order(
            account_id=account_id,
            symbol=symbol.upper(),
            order_id=order_id,
            new_quantity=req.new_quantity,
            new_price=req.new_price,
        )
        return _to_order_response(modified)
    except OrderNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (InsufficientMarginError, InvalidOrderError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{order_id}", response_model=OrderResponse)
def cancel_order(
    order_id: str,
    account_id: str = Query(default="DEFAULT"),
    symbol: str = Query(..., description="Order instrument symbol"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Cancels an active resting order and releases blocked margin.
    """
    try:
        cancelled = trade_service.cancel_order(
            account_id=account_id,
            symbol=symbol.upper(),
            order_id=order_id,
        )
        return _to_order_response(cancelled)
    except OrderNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidOrderError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OrderResponse])
def get_orders(
    account_id: str = Query(default="DEFAULT"),
    order_status: Optional[OrderStatus] = Query(default=None, alias="status"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Retrieves all orders placed for an account with optional status filter.
    """
    orders = trade_service.get_orders(account_id=account_id, status=order_status)
    return [_to_order_response(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order_by_id(
    order_id: str,
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Retrieves an order by its ID.
    """
    order = trade_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order '{order_id}' not found.")
    return _to_order_response(order)


@router.get("/trades/history", response_model=List[TradeResponse], tags=["Trades"])
def get_trades(
    account_id: str = Query(default="DEFAULT"),
    symbol: Optional[str] = Query(default=None),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Retrieves execution trade history for an account.
    """
    trades = trade_service.get_trades(account_id=account_id, symbol=symbol)
    return [
        TradeResponse(
            trade_id=t.trade_id,
            order_id=t.order_id,
            symbol=t.symbol,
            side=t.side,
            price=t.price,
            quantity=t.quantity,
            counterparty_order_id=t.counterparty_order_id,
            is_maker=t.is_maker,
            timestamp=t.timestamp,
        )
        for t in trades
    ]
