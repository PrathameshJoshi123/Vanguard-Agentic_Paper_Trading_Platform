import pytest
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from src.core.trade_service import TradeExecutionService
from src.core.models import Order
from src.common.types import Side, OrderType, ProductType, OrderStatus
from src.core.reconciliation import AuditReconciliationService
from src.core.recovery import CrashRecoveryService
from src.storage.database import Base
from src.storage.models.order import OrderModel
from src.storage.models.trade import TradeModel
from src.storage.models.position import PositionModel
from src.storage.models.ledger import CustomerCashEntryModel


@pytest.mark.asyncio
async def test_audit_reconciliation_zero_discrepancy():
    """Verifies that an active trading state passes all 4 audit checks with 0 discrepancy."""
    svc = TradeExecutionService()
    svc.register_account("ACC_AUDIT", initial_deposit=Decimal("500000.00"))
    svc.register_account("ACC_MAKER", initial_deposit=Decimal("500000.00"))

    # Place and match a trade: Maker sell MIS, Taker buy MIS
    maker_order = Order(
        order_id="ORD_M1",
        account_id="ACC_MAKER",
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        price=Decimal("2500.00"),
        quantity=50,
        product_type=ProductType.MIS,
    )
    svc.place_order(maker_order)

    taker_order = Order(
        order_id="ORD_T1",
        account_id="ACC_AUDIT",
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("2500.00"),
        quantity=50,
        product_type=ProductType.MIS,
    )
    svc.place_order(taker_order)

    auditor = AuditReconciliationService(svc)
    report = auditor.reconcile("ACC_AUDIT")

    assert report["is_balanced"] is True
    assert report["status"] == "BALANCED"
    assert report["discrepancy"] == "0.00"
    for check in report["checks"]:
        assert check["passed"] is True


@pytest.mark.asyncio
async def test_cold_crash_recovery_from_database():
    """
    Step 2 Test:
    Persists trading entities to database, wipes memory, recovers state,
    and proves zero discrepancy between persisted state and reconstituted engine.
    """
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    account_id = "ACC_RECOVER_01"

    async with TestSession() as session:
        async with session.begin():
            # Add initial cash entry
            entry = CustomerCashEntryModel(
                entry_id="CCE_INIT_01",
                account_id=account_id,
                category="CASH_DEPOSIT",
                debit=Decimal("0.00"),
                credit=Decimal("200000.00"),
                running_balance=Decimal("200000.00"),
                reference_id="INIT",
                description="Deposit",
            )
            session.add(entry)

            # Add completed trade
            trade = TradeModel(
                trade_id="TRD_REC_01",
                order_id="ORD_REC_01",
                symbol="RELIANCE",
                side="BUY",
                price=Decimal("2500.00"),
                quantity=20,
                counterparty_order_id="ORD_MAKER_01",
                is_maker=False,
            )
            session.add(trade)

            # Add filled order
            order = OrderModel(
                order_id="ORD_REC_01",
                account_id=account_id,
                symbol="RELIANCE",
                side="BUY",
                order_type="LIMIT",
                product_type="CNC",
                quantity=20,
                price=Decimal("2500.00"),
                status="FILLED",
                filled_qty=20,
                remaining_qty=0,
                average_fill_price=Decimal("2500.00"),
            )
            session.add(order)

            # Add resting open order
            open_order = OrderModel(
                order_id="ORD_REC_OPEN_01",
                account_id=account_id,
                symbol="RELIANCE",
                side="BUY",
                order_type="LIMIT",
                product_type="CNC",
                quantity=10,
                price=Decimal("2450.00"),
                status="OPEN",
                filled_qty=0,
                remaining_qty=10,
            )
            session.add(open_order)

            # Add position
            pos = PositionModel(
                account_id=account_id,
                symbol="RELIANCE",
                product_type="CNC",
                quantity=20,
                average_price=Decimal("2500.00"),
                realized_pnl=Decimal("0.00"),
                unrealized_pnl=Decimal("0.00"),
            )
            session.add(pos)

    # Initialize service and wipe in-memory state
    trade_service = TradeExecutionService()
    recovery_service = CrashRecoveryService(trade_service)

    async with TestSession() as session:
        recovery_result = await recovery_service.recover_from_database(session, account_id=account_id)

    assert recovery_result["status"] == "RECOVERED"
    assert recovery_result["reconstructed_orders"] >= 2
    assert recovery_result["reconstructed_trades"] >= 1
    assert recovery_result["final_cash_balance"] == "200000.00"

    # Verify resting open order is back in the book
    book = trade_service.matching_engine.get_book("RELIANCE")
    depth = book.get_market_depth(levels=5)
    bid_prices = [float(b["price"]) for b in depth["bids"]]
    assert 2450.0 in bid_prices

    # Verify reconciliation passed with 0 discrepancy
    rec = recovery_result["reconciliation"]
    assert rec["is_balanced"] is True
    assert rec["discrepancy"] == "0.00"
