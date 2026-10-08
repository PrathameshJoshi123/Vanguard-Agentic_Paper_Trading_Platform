import logging
import uuid
from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from src.common.clock import Clock, default_clock
from src.common.types import OrderStatus, OrderType, ProductType, Side
from src.core.models import Order
from src.core.trade_service import TradeExecutionResult, TradeExecutionService
from src.events.models import DomainEvent, DomainEventType

logger = logging.getLogger(__name__)


class MISSquareOffResult(BaseModel):
    """Summarizes an individual position square-off execution."""
    account_id: str
    symbol: str
    closed_quantity: int
    side: Side
    exit_price: Decimal
    order_id: str
    status: OrderStatus
    realized_pnl: Optional[Decimal] = None


class MISSquareOffManager:
    """
    Deterministic MIS Auto Square-off Engine adhering to plan.txt Section 29 and ps.txt.
    Scans all open MIS positions and injects closing market orders directly into the engine.
    Completely isolated from LLM decision making.
    """

    def __init__(
        self,
        trade_service: TradeExecutionService,
        clock: Optional[Clock] = None,
    ):
        self.trade_service = trade_service
        self.clock = clock or default_clock

    def square_off_all_mis(self) -> List[MISSquareOffResult]:
        """
        Executes immediate square-off for all open MIS positions across all accounts.
        """
        logger.info("Deterministic MIS auto square-off triggered.")

        # Emit triggered domain event
        if self.trade_service.event_bus:
            self.trade_service.event_bus.publish_nowait(
                DomainEvent(
                    event_id=f"EVT_{uuid.uuid4().hex[:12]}",
                    event_type=DomainEventType.MIS_SQUAREOFF_TRIGGERED,
                    entity_type="SETTLEMENT",
                    entity_id="MIS_SQUAREOFF",
                    payload={"trigger_time": self.clock.now().isoformat()},
                )
            )

        results: List[MISSquareOffResult] = []

        # Find all open MIS positions
        open_mis_positions = [
            pos for pos in self.trade_service.position_manager._positions.values()
            if pos.product_type == ProductType.MIS and pos.is_open
        ]

        logger.info(f"Found {len(open_mis_positions)} open MIS positions to square off.")

        for pos in open_mis_positions:
            res = self._square_off_single_position(pos)
            if res:
                results.append(res)

        # Emit completed domain event
        if self.trade_service.event_bus:
            self.trade_service.event_bus.publish_nowait(
                DomainEvent(
                    event_id=f"EVT_{uuid.uuid4().hex[:12]}",
                    event_type=DomainEventType.MIS_SQUAREOFF_COMPLETED,
                    entity_type="SETTLEMENT",
                    entity_id="MIS_SQUAREOFF",
                    payload={
                        "completed_time": self.clock.now().isoformat(),
                        "squared_off_count": len(results),
                        "details": [r.model_dump(mode="json") for r in results],
                    },
                )
            )

        return results

    def square_off_account_mis(self, account_id: str) -> List[MISSquareOffResult]:
        """Squares off open MIS positions for a specific account."""
        open_mis = [
            pos for pos in self.trade_service.position_manager._positions.values()
            if pos.account_id == account_id and pos.product_type == ProductType.MIS and pos.is_open
        ]
        results = []
        for pos in open_mis:
            res = self._square_off_single_position(pos)
            if res:
                results.append(res)
        return results

    def _square_off_single_position(self, pos) -> Optional[MISSquareOffResult]:
        symbol = pos.symbol
        closing_qty = abs(pos.quantity)
        closing_side = Side.SELL if pos.quantity > 0 else Side.BUY

        book = self.trade_service.matching_engine.get_or_create_book(symbol)
        latest_price = self.trade_service.position_manager._latest_prices.get(symbol, pos.average_price)

        # In paper mode, ensure liquidity exists on the opposite side at current market price
        if closing_side == Side.SELL and book.peek_best_bid() is None:
            # Seed exchange bid liquidity
            liquidity_order = Order(
                order_id=f"MKT-LIQ-BUY-{uuid.uuid4().hex[:6].upper()}",
                symbol=symbol,
                side=Side.BUY,
                order_type=OrderType.LIMIT,
                price=latest_price,
                quantity=closing_qty,
                account_id="EXCHANGE_LIQUIDITY",
                status=OrderStatus.PENDING,
            )
            # Ensure liquidity account exists
            self.trade_service.get_account("EXCHANGE_LIQUIDITY")
            self.trade_service.matching_engine.place_order(liquidity_order)

        elif closing_side == Side.BUY and book.peek_best_ask() is None:
            # Seed exchange ask liquidity
            liquidity_order = Order(
                order_id=f"MKT-LIQ-SELL-{uuid.uuid4().hex[:6].upper()}",
                symbol=symbol,
                side=Side.SELL,
                order_type=OrderType.LIMIT,
                price=latest_price,
                quantity=closing_qty,
                account_id="EXCHANGE_LIQUIDITY",
                status=OrderStatus.PENDING,
            )
            self.trade_service.get_account("EXCHANGE_LIQUIDITY")
            self.trade_service.matching_engine.place_order(liquidity_order)

        # Place closing market order
        closing_order = Order(
            order_id=f"MIS-SQ-{uuid.uuid4().hex[:8].upper()}",
            symbol=symbol,
            side=closing_side,
            order_type=OrderType.MARKET,
            price=latest_price,
            quantity=closing_qty,
            product_type=ProductType.MIS,
            account_id=pos.account_id,
        )

        try:
            exec_res: TradeExecutionResult = self.trade_service.place_order(closing_order)
            fill_price = latest_price
            if exec_res.match_result.trade_events:
                fill_price = exec_res.match_result.trade_events[0].price

            return MISSquareOffResult(
                account_id=pos.account_id,
                symbol=symbol,
                closed_quantity=closing_qty,
                side=closing_side,
                exit_price=fill_price,
                order_id=closing_order.order_id,
                status=closing_order.status,
                realized_pnl=pos.realized_pnl,
            )
        except Exception as e:
            logger.error(f"Failed to square off MIS position {symbol} for {pos.account_id}: {e}")
            return None
