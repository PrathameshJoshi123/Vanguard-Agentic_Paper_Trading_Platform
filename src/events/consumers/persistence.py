import asyncio
import json
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
from src.storage.models.ledger import (
    CustomerCashEntryModel,
    DoubleEntryTransactionModel,
    DoubleEntryLegModel,
)
from src.storage.models.account import AccountModel
from src.storage.models.event_log import EventLogModel
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
                    # 1. Append immutable event log
                    db_log = EventLogModel(
                        event_id=event.event_id,
                        event_type=event.event_type,
                        entity_type=event.entity_type,
                        entity_id=event.entity_id,
                        account_id=event.account_id,
                        payload_json=json.dumps(event.payload, default=str),
                        sequence=event.sequence,
                        timestamp=event.timestamp,
                    )
                    session.add(db_log)

                    # 2. Materialized entity persistence
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

                    elif event.event_type == DomainEventType.LEDGER_ENTRY_RECORDED:
                        p = event.payload
                        entry_id = p.get("entry_id")
                        if entry_id:
                            stmt = select(CustomerCashEntryModel).where(CustomerCashEntryModel.entry_id == entry_id)
                            res = await session.execute(stmt)
                            if not res.scalar_one_or_none():
                                db_entry = CustomerCashEntryModel(
                                    entry_id=entry_id,
                                    account_id=p.get("account_id", "DEFAULT"),
                                    category=p.get("category", "TRADE_SETTLEMENT"),
                                    debit=Decimal(str(p.get("debit", "0.00"))),
                                    credit=Decimal(str(p.get("credit", "0.00"))),
                                    running_balance=Decimal(str(p.get("running_balance", "0.00"))),
                                    reference_id=p.get("reference_id", ""),
                                    description=p.get("description", ""),
                                )
                                session.add(db_entry)

                    elif event.event_type == DomainEventType.POSITION_UPDATED:
                        p = event.payload
                        account_id = p.get("account_id", "DEFAULT")
                        symbol = p.get("symbol")
                        product_type = p.get("product_type", "CNC")
                        if symbol:
                            stmt = select(PositionModel).where(
                                PositionModel.account_id == account_id,
                                PositionModel.symbol == symbol,
                                PositionModel.product_type == product_type,
                            )
                            res = await session.execute(stmt)
                            pos = res.scalar_one_or_none()
                            avg_px = Decimal(str(p.get("average_price") or p.get("average_buy_price") or "0.00"))
                            tot_chg = Decimal(str(p.get("total_charges", "0.00")))
                            if not pos:
                                pos = PositionModel(
                                    account_id=account_id,
                                    symbol=symbol,
                                    product_type=product_type,
                                    quantity=p.get("quantity", 0),
                                    average_price=avg_px,
                                    realized_pnl=Decimal(str(p.get("realized_pnl", "0.00"))),
                                    unrealized_pnl=Decimal(str(p.get("unrealized_pnl", "0.00"))),
                                    total_charges=tot_chg,
                                )
                                session.add(pos)
                            else:
                                pos.quantity = p.get("quantity", pos.quantity)
                                pos.average_price = avg_px
                                pos.realized_pnl = Decimal(str(p.get("realized_pnl", pos.realized_pnl)))
                                pos.unrealized_pnl = Decimal(str(p.get("unrealized_pnl", pos.unrealized_pnl)))
                                pos.total_charges = tot_chg

                    elif event.event_type == DomainEventType.HOLDING_UPDATED:
                        p = event.payload
                        account_id = p.get("account_id", "DEFAULT")
                        symbol = p.get("symbol")
                        if symbol:
                            stmt = select(HoldingModel).where(
                                HoldingModel.account_id == account_id,
                                HoldingModel.symbol == symbol,
                            )
                            res = await session.execute(stmt)
                            holding = res.scalar_one_or_none()
                            avg_buy = Decimal(str(p.get("average_buy_price", "0.00")))
                            qty_val = p.get("quantity", 0)
                            if not holding:
                                holding = HoldingModel(
                                    account_id=account_id,
                                    symbol=symbol,
                                    quantity=qty_val,
                                    average_buy_price=avg_buy,
                                )
                                session.add(holding)
                            else:
                                holding.quantity = qty_val
                                holding.average_buy_price = avg_buy

                    elif event.event_type == DomainEventType.MARGIN_UTILIZATION_CHANGED:
                        p = event.payload
                        acc_id = event.account_id or "DEFAULT"
                        stmt = select(AccountModel).where(AccountModel.account_id == acc_id)
                        res = await session.execute(stmt)
                        acc = res.scalar_one_or_none()
                        cash_val = Decimal(str(p.get("cash_balance", "0.00")))
                        block_val = Decimal(str(p.get("blocked_margin", "0.00")))
                        if not acc:
                            acc = AccountModel(
                                account_id=acc_id,
                                cash_balance=cash_val,
                                blocked_margin=block_val,
                            )
                            session.add(acc)
                        else:
                            acc.cash_balance = cash_val
                            acc.blocked_margin = block_val

                    elif event.event_type == DomainEventType.DOUBLE_ENTRY_TXN_RECORDED:
                        p = event.payload
                        txn_id = p.get("transaction_id")
                        if txn_id:
                            stmt = select(DoubleEntryTransactionModel).where(
                                DoubleEntryTransactionModel.transaction_id == txn_id
                            )
                            res = await session.execute(stmt)
                            if not res.scalar_one_or_none():
                                db_txn = DoubleEntryTransactionModel(
                                    transaction_id=txn_id,
                                    reference_id=p.get("reference_id", ""),
                                    reference_type=p.get("reference_type", "GENERAL"),
                                    description=p.get("description", ""),
                                )
                                session.add(db_txn)
                                for leg in p.get("legs", []):
                                    db_leg = DoubleEntryLegModel(
                                        transaction_id=txn_id,
                                        account_category=leg.get("account_category", "USER_CASH"),
                                        account_id=leg.get("account_id", "DEFAULT"),
                                        debit=Decimal(str(leg.get("debit", "0.00"))),
                                        credit=Decimal(str(leg.get("credit", "0.00"))),
                                    )
                                    session.add(db_leg)
        except Exception as e:
            logger.warning(f"Async persistence notice: {e}")
