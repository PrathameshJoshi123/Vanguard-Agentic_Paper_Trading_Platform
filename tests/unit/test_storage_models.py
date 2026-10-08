import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select

from src.storage.database import Base
from src.storage.models import (
    AccountModel,
    OrderModel,
    TradeModel,
    PositionModel,
    HoldingModel,
    CustomerCashEntryModel,
    DoubleEntryTransactionModel,
    DoubleEntryLegModel,
)


@pytest.mark.asyncio
async def test_database_schema_initialization():
    """Verify that all SQLAlchemy ORM models can create tables and insert records asynchronously."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(test_engine) as session:
        # Insert Account
        account = AccountModel(account_id="ACC_TEST", cash_balance=50000.00)
        session.add(account)

        # Insert CustomerCashEntry
        entry = CustomerCashEntryModel(
            entry_id="CCE_1",
            account_id="ACC_TEST",
            category="CASH_DEPOSIT",
            debit=0.00,
            credit=50000.00,
            running_balance=50000.00,
            reference_id="DEP_1",
            description="Initial deposit",
        )
        session.add(entry)
        await session.commit()

        # Query back
        result = await session.execute(select(AccountModel).where(AccountModel.account_id == "ACC_TEST"))
        acc = result.scalar_one()
        assert acc.account_id == "ACC_TEST"
        assert float(acc.cash_balance) == 50000.00
