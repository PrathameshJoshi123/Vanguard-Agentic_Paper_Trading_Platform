import asyncio
import sys
import json
from decimal import Decimal
from sqlalchemy import select, func

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import os
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("src"))

from src.storage.database import db_settings, AsyncSessionLocal, init_db
from src.storage.models.event_log import EventLogModel
from src.storage.models.order import OrderModel
from src.storage.models.trade import TradeModel
from src.storage.models.ledger import CustomerCashEntryModel, DoubleEntryTransactionModel, DoubleEntryLegModel
from src.storage.models.position import PositionModel, HoldingModel
from src.storage.models.account import AccountModel


async def inspect_database():
    print("=" * 70)
    print("DATABASE INSPECTION & HEALTH CHECK")
    print("=" * 70)
    print(f"Configured Database URL: {db_settings.database_url}")
    print(f"Async Database URL:      {db_settings.async_database_url}")
    print("-" * 70)

    await init_db()

    async with AsyncSessionLocal() as session:
        # 1. Count Event Logs
        stmt = select(func.count(EventLogModel.event_id))
        log_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Event Logs (event_logs table):               {log_count}")

        # 2. Count Orders
        stmt = select(func.count(OrderModel.order_id))
        order_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Orders (orders table):                        {order_count}")

        # 3. Count Trades
        stmt = select(func.count(TradeModel.trade_id))
        trade_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Trades (trades table):                        {trade_count}")

        # 4. Count Customer Cash Entries
        stmt = select(func.count(CustomerCashEntryModel.entry_id))
        cash_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Customer Cash Entries (customer_cash_entries): {cash_count}")

        # 5. Count Positions
        stmt = select(func.count(PositionModel.symbol))
        pos_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Positions (positions table):                  {pos_count}")

        # 6. Count Holdings
        stmt = select(func.count(HoldingModel.symbol))
        hold_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Holdings (holdings table):                    {hold_count}")

        # 7. Count Double Entry Transactions & Legs
        stmt = select(func.count(DoubleEntryTransactionModel.transaction_id))
        tx_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Double Entry Transactions:                    {tx_count}")

        stmt = select(func.count(DoubleEntryLegModel.id))
        leg_count = (await session.execute(stmt)).scalar() or 0
        print(f"[*] Total Double Entry Legs:                            {leg_count}")

        # 8. Inspect sample records if any exist
        if cash_count > 0:
            print("\nRecent Customer Cash Entries:")
            stmt = select(CustomerCashEntryModel).order_by(CustomerCashEntryModel.timestamp.desc()).limit(5)
            entries = (await session.execute(stmt)).scalars().all()
            for e in entries:
                print(f"  - Account={e.account_id}, Cat={e.category}, Debit={e.debit}, Credit={e.credit}, RunBal={e.running_balance}, Ref={e.reference_id}")

        if pos_count > 0:
            print("\nPositions:")
            stmt = select(PositionModel).limit(5)
            positions = (await session.execute(stmt)).scalars().all()
            for p in positions:
                print(f"  - Account={p.account_id}, Sym={p.symbol}, Prod={p.product_type}, Qty={p.quantity}, AvgPx={p.average_price}, RealizedPnL={p.realized_pnl}")

    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(inspect_database())
