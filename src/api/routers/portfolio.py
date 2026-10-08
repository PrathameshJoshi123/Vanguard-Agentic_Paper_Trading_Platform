from decimal import Decimal
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, HTTPException, status

from src.common.types import Side, OrderType, OrderStatus, ProductType
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.api.schemas.portfolio import (
    PositionResponse,
    HoldingResponse,
    PortfolioSummaryResponse,
)

router = APIRouter(tags=["Portfolio"])


@router.get("/positions", response_model=List[PositionResponse])
@router.get("/portfolio/positions", response_model=List[PositionResponse])
def get_positions(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Retrieves all open and closed positions for an account with real-time VWAP and P&L.
    """
    summary = trade_service.position_manager.get_portfolio_summary(account_id)
    return [
        PositionResponse(
            account_id=p.account_id,
            symbol=p.symbol,
            product_type=p.product_type,
            quantity=p.quantity,
            average_price=p.average_price,
            realized_pnl=p.realized_pnl,
            unrealized_pnl=p.unrealized_pnl,
            total_charges=p.total_charges,
            net_pnl=p.net_pnl,
            is_open=p.is_open,
            is_long=p.is_long,
        )
        for p in summary.positions
    ]


@router.get("/portfolio/{account_id}/positions", response_model=List[PositionResponse])
def get_positions_by_path(
    account_id: str,
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    return get_positions(account_id=account_id, trade_service=trade_service)


@router.get("/holdings", response_model=List[HoldingResponse])
@router.get("/portfolio/holdings", response_model=List[HoldingResponse])
def get_holdings(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Retrieves delivery (CNC) equity holdings in Demat.
    """
    summary = trade_service.position_manager.get_portfolio_summary(account_id)
    return [
        HoldingResponse(
            account_id=h.account_id,
            symbol=h.symbol,
            quantity=h.quantity,
            average_buy_price=h.average_buy_price,
        )
        for h in summary.holdings
    ]


@router.get("/portfolio/{account_id}/holdings", response_model=List[HoldingResponse])
def get_holdings_by_path(
    account_id: str,
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    return get_holdings(account_id=account_id, trade_service=trade_service)


@router.get("/portfolio/summary", response_model=PortfolioSummaryResponse)
def get_portfolio_summary(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):

    """
    Aggregates full portfolio summary including open positions count, total charges, gross and net P&L.
    """
    summary = trade_service.position_manager.get_portfolio_summary(account_id)
    return PortfolioSummaryResponse(
        account_id=summary.account_id,
        total_realized_pnl=summary.total_realized_pnl,
        total_unrealized_pnl=summary.total_unrealized_pnl,
        total_charges=summary.total_charges,
        gross_pnl=summary.gross_pnl,
        net_pnl=summary.net_pnl,
        open_positions_count=summary.open_positions_count,
        positions=[
            PositionResponse(
                account_id=p.account_id,
                symbol=p.symbol,
                product_type=p.product_type,
                quantity=p.quantity,
                average_price=p.average_price,
                realized_pnl=p.realized_pnl,
                unrealized_pnl=p.unrealized_pnl,
                total_charges=p.total_charges,
                net_pnl=p.net_pnl,
                is_open=p.is_open,
                is_long=p.is_long,
            )
            for p in summary.positions
        ],
        holdings=[
            HoldingResponse(
                account_id=h.account_id,
                symbol=h.symbol,
                quantity=h.quantity,
                average_buy_price=h.average_buy_price,
            )
            for h in summary.holdings
        ],
    )


@router.post("/portfolio/squareoff/{symbol}", status_code=status.HTTP_200_OK)
def square_off_position(
    symbol: str,
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Squares off an open position for a given symbol by executing an opposite closing market order.
    """
    sym = symbol.upper()
    positions = trade_service.position_manager.get_positions(account_id)
    target_pos = next((p for p in positions if p.symbol == sym and p.is_open), None)
    if not target_pos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No open position found for symbol '{sym}' in account '{account_id}'.",
        )

    closing_qty = abs(target_pos.quantity)
    closing_side = Side.SELL if target_pos.quantity > 0 else Side.BUY
    latest_price = trade_service.position_manager._latest_prices.get(sym, target_pos.average_price)

    # In paper mode, ensure liquidity exists on the opposite side
    book = trade_service.matching_engine.get_or_create_book(sym)
    if closing_side == Side.SELL and book.peek_best_bid() is None:
        liquidity_order = Order(
            order_id=f"MKT-LIQ-BUY-{uuid.uuid4().hex[:6].upper()}",
            symbol=sym,
            side=Side.BUY,
            order_type=OrderType.LIMIT,
            price=latest_price,
            quantity=closing_qty,
            account_id="EXCHANGE_LIQUIDITY",
            status=OrderStatus.OPEN,
        )
        trade_service.get_account("EXCHANGE_LIQUIDITY")
        trade_service._orders[liquidity_order.order_id] = liquidity_order
        book.add_order(liquidity_order)
    elif closing_side == Side.BUY and book.peek_best_ask() is None:
        liquidity_order = Order(
            order_id=f"MKT-LIQ-SELL-{uuid.uuid4().hex[:6].upper()}",
            symbol=sym,
            side=Side.SELL,
            order_type=OrderType.LIMIT,
            price=latest_price,
            quantity=closing_qty,
            account_id="EXCHANGE_LIQUIDITY",
            status=OrderStatus.OPEN,
        )
        trade_service.get_account("EXCHANGE_LIQUIDITY")
        trade_service._orders[liquidity_order.order_id] = liquidity_order
        book.add_order(liquidity_order)

    closing_order = Order(
        order_id=f"SQ-{uuid.uuid4().hex[:8].upper()}",
        symbol=sym,
        side=closing_side,
        order_type=OrderType.MARKET,
        price=latest_price,
        quantity=closing_qty,
        product_type=target_pos.product_type,
        account_id=account_id,
        status=OrderStatus.PENDING,
    )

    try:
        exec_res = trade_service.place_order(closing_order)
        fill_price = latest_price
        if exec_res.match_result.trade_events:
            fill_price = exec_res.match_result.trade_events[0].price

        return {
            "status": "SQUARED_OFF",
            "symbol": sym,
            "side": closing_side.value,
            "closed_quantity": closing_qty,
            "exit_price": float(fill_price),
            "order_id": closing_order.order_id,
            "order_status": closing_order.status.value,
            "realized_pnl": float(target_pos.realized_pnl),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to square off position {sym}: {str(e)}",
        )

