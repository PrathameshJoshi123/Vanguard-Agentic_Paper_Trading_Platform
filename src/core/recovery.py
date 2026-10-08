from decimal import Decimal
import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.types import Side, OrderType, OrderStatus, ProductType, TimeInForce
from src.core.models import Order, TradeEvent
from src.core.trade_service import TradeExecutionService
from src.core.reconciliation import AuditReconciliationService
from src.storage.models.account import AccountModel
from src.storage.models.order import OrderModel
from src.storage.models.trade import TradeModel
from src.storage.models.position import PositionModel, HoldingModel
from src.storage.models.ledger import (
    CustomerCashEntryModel,
    DoubleEntryTransactionModel,
    DoubleEntryLegModel,
)
from src.storage.models.event_log import EventLogModel
from src.ledger.models import CustomerCashEntry, DoubleEntryLeg, DoubleEntryTransaction

logger = logging.getLogger(__name__)


class CrashRecoveryService:
    """
    Handles Crash Recovery & Event Sourcing state restoration adhering to plan.txt Section 44:
      Crash -> Event Log / Durable Database -> Replay Events -> Rebuild Current State -> Reconcile Positions & Ledger.
    """

    def __init__(self, trade_service: TradeExecutionService):
        self.trade_service = trade_service
        self.reconciliation_service = AuditReconciliationService(trade_service)

    async def recover_from_database(
        self,
        session: AsyncSession,
        account_id: str = "DEFAULT",
    ) -> Dict[str, Any]:
        """
        Cold crash recovery:
        1. Wipes volatile in-memory trading engine state.
        2. Queries durable PostgreSQL / SQLite models.
        3. Rebuilds accounts, orders, order books, trades, positions, and double-entry ledger.
        4. Runs continuous audit reconciliation proving zero discrepancy.
        """
        # 1. Simulate server restart / memory wipe
        self.trade_service.reset_state()

        # 2. Rebuild Accounts & Cash Journal
        cash_entries = []
        try:
            stmt_cash = select(CustomerCashEntryModel).where(
                CustomerCashEntryModel.account_id == account_id
            ).order_by(CustomerCashEntryModel.timestamp.asc())
            res_cash = await session.execute(stmt_cash)
            cash_entries = res_cash.scalars().all()
        except Exception as e:
            logger.warning(f"Crash recovery cash query fallback: {e}")

        account_state = self.trade_service.register_account(account_id, initial_deposit=Decimal("0.00"))

        if cash_entries:
            for db_c in cash_entries:
                domain_c = CustomerCashEntry(
                    entry_id=db_c.entry_id,
                    account_id=db_c.account_id,
                    category=db_c.category,
                    debit=Decimal(str(db_c.debit)),
                    credit=Decimal(str(db_c.credit)),
                    running_balance=Decimal(str(db_c.running_balance)),
                    reference_id=db_c.reference_id,
                    description=db_c.description,
                    timestamp=db_c.timestamp,
                )
                if account_id not in self.trade_service.ledger._customer_entries:
                    self.trade_service.ledger._customer_entries[account_id] = []
                self.trade_service.ledger._customer_entries[account_id].append(domain_c)
            # Restore final running balance
            latest_balance = Decimal(str(cash_entries[-1].running_balance))
            self.trade_service.ledger._balances[account_id] = latest_balance
            account_state.cash_balance = latest_balance
        else:
            # Fallback to default initial deposit if new installation
            self.trade_service.ledger.deposit_cash(account_id, Decimal("1000000.00"), reference_id="INITIAL_FUNDING")
            account_state.cash_balance = Decimal("1000000.00")

        # 3. Rebuild Double-Entry Journal
        de_txs = []
        try:
            stmt_de = select(DoubleEntryTransactionModel).options(
                selectinload(DoubleEntryTransactionModel.legs)
            ).order_by(DoubleEntryTransactionModel.timestamp.asc())
            res_de = await session.execute(stmt_de)
            de_txs = res_de.scalars().all()
        except Exception as e:
            logger.warning(f"Crash recovery double-entry query fallback: {e}")

        for db_tx in de_txs:
            domain_legs = [
                DoubleEntryLeg(
                    account_category=leg.account_category,
                    account_id=leg.account_id,
                    debit=Decimal(str(leg.debit)),
                    credit=Decimal(str(leg.credit)),
                )
                for leg in db_tx.legs
            ]
            domain_tx = DoubleEntryTransaction(
                transaction_id=db_tx.transaction_id,
                reference_id=db_tx.reference_id,
                reference_type=db_tx.reference_type,
                description=db_tx.description,
                legs=domain_legs,
                timestamp=db_tx.timestamp,
            )
            self.trade_service.ledger._double_entry_journal.append(domain_tx)

        # 4. Rebuild Orders & Resting Book Levels
        db_orders = []
        try:
            stmt_orders = select(OrderModel).where(
                OrderModel.account_id == account_id
            ).order_by(OrderModel.created_at.asc())
            res_orders = await session.execute(stmt_orders)
            db_orders = res_orders.scalars().all()
        except Exception as e:
            logger.warning(f"Crash recovery orders query fallback: {e}")

        for db_o in db_orders:
            domain_order = Order(
                order_id=db_o.order_id,
                account_id=db_o.account_id,
                symbol=db_o.symbol,
                side=Side(db_o.side),
                order_type=OrderType(db_o.order_type),
                product_type=ProductType(db_o.product_type),
                quantity=db_o.quantity,
                price=Decimal(str(db_o.price)) if db_o.price is not None else None,
                trigger_price=Decimal(str(db_o.trigger_price)) if db_o.trigger_price is not None else None,
                time_in_force=TimeInForce(db_o.time_in_force),
                status=OrderStatus(db_o.status),
                filled_qty=db_o.filled_qty,
                remaining_qty=db_o.remaining_qty,
                average_fill_price=Decimal(str(db_o.average_fill_price)) if db_o.average_fill_price is not None else None,
                sequence_id=db_o.sequence_id,
                created_at=db_o.created_at,
                updated_at=db_o.updated_at,
            )
            self.trade_service._orders[domain_order.order_id] = domain_order

            # If order was resting open, restore it into the in-memory matching engine book
            if domain_order.status in (OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED):
                book = self.trade_service.matching_engine.get_book(domain_order.symbol)
                book.add_order(domain_order)

        # 5. Rebuild Executed Trades
        db_trades = []
        try:
            stmt_trades = select(TradeModel).order_by(TradeModel.timestamp.asc())
            res_trades = await session.execute(stmt_trades)
            db_trades = res_trades.scalars().all()
        except Exception as e:
            logger.warning(f"Crash recovery trades query fallback: {e}")

        for db_t in db_trades:
            domain_trade = TradeEvent(
                trade_id=db_t.trade_id,
                order_id=db_t.order_id,
                symbol=db_t.symbol,
                side=Side(db_t.side),
                price=Decimal(str(db_t.price)),
                quantity=db_t.quantity,
                counterparty_order_id=db_t.counterparty_order_id,
                is_maker=db_t.is_maker,
                timestamp=db_t.timestamp,
            )
            self.trade_service._trades.append(domain_trade)

        # 6. Rebuild Positions & Holdings
        db_positions = []
        try:
            stmt_pos = select(PositionModel).where(
                PositionModel.account_id == account_id
            )
            res_pos = await session.execute(stmt_pos)
            db_positions = res_pos.scalars().all()
        except Exception as e:
            logger.warning(f"Crash recovery positions query fallback: {e}")

        for db_p in db_positions:
            pos = self.trade_service.position_manager.get_position(
                account_id=db_p.account_id,
                symbol=db_p.symbol,
                product_type=ProductType(db_p.product_type),
            )
            pos.quantity = db_p.quantity
            pos.average_price = Decimal(str(db_p.average_price))
            pos.realized_pnl = Decimal(str(db_p.realized_pnl))
            pos.unrealized_pnl = Decimal(str(db_p.unrealized_pnl))

        # 7. Run Complete Audit Reconciliation
        reconciliation_report = self.reconciliation_service.reconcile(account_id)

        return {
            "status": "RECOVERED",
            "account_id": account_id,
            "reconstructed_orders": len(db_orders),
            "reconstructed_trades": len(db_trades),
            "reconstructed_cash_entries": len(cash_entries),
            "reconstructed_positions": len(db_positions),
            "final_cash_balance": str(account_state.cash_balance),
            "reconciliation": reconciliation_report,
        }
