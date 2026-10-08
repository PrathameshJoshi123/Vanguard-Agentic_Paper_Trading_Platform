import asyncio
from datetime import datetime
from decimal import Decimal
import logging
from typing import Optional

from src.events.bus import InMemoryEventBus
from src.events.models import DomainEvent, DomainEventType
from src.storage.database import AsyncSessionLocal
from src.storage.models.order import OrderModel
from src.storage.models.trade import TradeModel
from src.storage.models.position import PositionModel, HoldingModel
from src.storage.models.ledger import CustomerCashEntryModel
from sqlalchemy import select

logger = logging.getLogger(__name__)


class DatabasePersistenceWorker:
    """
    Background worker asynchronously persisting domain events to PostgreSQL / SQLite.
    Decoupled from the <5ms trading path.
    """

    def __init__(self, event_bus: InMemoryEventBus):
        self.event_bus = event_bus
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._queue: Optional[asyncio.Queue[DomainEvent]] = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._queue = self.event_bus.subscribe("*")
        self._task = asyncio.create_task(self._run_loop())
        logger.info("DatabasePersistenceWorker started.")

    async def stop(self) -> None:
        self._running = False
        if self._queue:
            self.event_bus.unsubscribe("*", self._queue)
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("DatabasePersistenceWorker stopped.")

    async def _run_loop(self) -> None:
        while self._running and self._queue:
            try:
                event: DomainEvent = await self._queue.get()
                await self._persist_event(event)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error persisting event {getattr(event, 'event_id', '?')}: {e}")

    async def _persist_event(self, event: DomainEvent) -> None:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    if event.event_type in (
                        DomainEventType.ORDER_PLACED,
                        DomainEventType.ORDER_MODIFIED,
                        DomainEventType.ORDER_CANCELLED,
                    ):
                        p = event.payload
                        order_id = p.get("order_id")
                        if not order_id:
                            return

                        stmt = select(OrderModel).where(OrderModel.order_id == order_id)
                        res = await session.execute(stmt)
                        db_order = res.scalar_one_or_none()

                        price_val = Decimal(str(p["price"])) if p.get("price") is not None else None
                        trig_val = Decimal(str(p["trigger_price"])) if p.get("trigger_price") is not None else None
                        avg_fill = Decimal(str(p["average_fill_price"])) if p.get("average_fill_price") is not None else None

                        if not db_order:
                            db_order = OrderModel(
                                order_id=order_id,
                                account_id=p.get("account_id", "DEFAULT"),
                                symbol=p["symbol"],
                                side=p["side"],
                                order_type=p["order_type"],
                                product_type=p.get("product_type", "CNC"),
                                quantity=p["quantity"],
                                price=price_val,
                                trigger_price=trig_val,
                                time_in_force=p.get("time_in_force", "DAY"),
                                status=p["status"],
                                filled_qty=p.get("filled_qty", 0),
                                remaining_qty=p.get("remaining_qty", 0),
                                average_fill_price=avg_fill,
                            )
                            session.add(db_order)
                        else:
                            db_order.status = p["status"]
                            db_order.quantity = p["quantity"]
                            db_order.filled_qty = p.get("filled_qty", db_order.filled_qty)
                            db_order.remaining_qty = p.get("remaining_qty", db_order.remaining_qty)
                            if price_val is not None:
                                db_order.price = price_val
                            if avg_fill is not None:
                                db_order.average_fill_price = avg_fill

                    elif event.event_type == DomainEventType.TRADE_EXECUTED:
                        p = event.payload
                        trade_id = p.get("trade_id")
                        if not trade_id:
                            return

                        stmt = select(TradeModel).where(TradeModel.trade_id == trade_id)
                        res = await session.execute(stmt)
                        if not res.scalar_one_or_none():
                            db_trade = TradeModel(
                                trade_id=trade_id,
                                order_id=p["order_id"],
                                symbol=p["symbol"],
                                side=p["side"],
                                price=Decimal(str(p["price"])),
                                quantity=p["quantity"],
                                counterparty_order_id=p.get("counterparty_order_id", ""),
                                is_maker=p.get("is_maker", False),
                            )
                            session.add(db_trade)
        except Exception as e:
            # Non-critical: failure in background persistence must not crash trading engine
            logger.debug(f"Async persistence notice: {e}")
