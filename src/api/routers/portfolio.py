from typing import List
from fastapi import APIRouter, Depends, Query

from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.api.schemas.portfolio import (
    PositionResponse,
    HoldingResponse,
    PortfolioSummaryResponse,
)

router = APIRouter(tags=["Portfolio"])


@router.get("/positions", response_model=List[PositionResponse])
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


@router.get("/holdings", response_model=List[HoldingResponse])
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
