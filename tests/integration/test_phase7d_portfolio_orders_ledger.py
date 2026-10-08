import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from src.api.app import app
from src.api.dependencies import get_trade_service
from src.common.types import Side, OrderType, ProductType, OrderStatus
from src.core.models import Order


@pytest.mark.asyncio
async def test_ledger_t_accounts_endpoint():
    """
    Verifies that GET /ledger/t-accounts and GET /api/v1/ledger/t-accounts
    return balanced T-Accounts with 0.00 discrepancy.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/ledger/t-accounts?account_id=DEFAULT")
        assert res.status_code == 200
        data = res.json()

        assert "total_debits" in data
        assert "total_credits" in data
        assert "is_balanced" in data
        assert "accounts" in data
        assert data["is_balanced"] is True
        assert Decimal(str(data["discrepancy"])) == Decimal("0.00")
        assert len(data["accounts"]) > 0


@pytest.mark.asyncio
async def test_ledger_contract_notes_endpoint():
    """
    Verifies that GET /ledger/contract-notes returns statutory charges summary.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/ledger/contract-notes?account_id=DEFAULT")
        assert res.status_code == 200
        data = res.json()

        assert "total_brokerage" in data
        assert "total_stt" in data
        assert "total_exchange_turnover" in data
        assert "total_sebi_fees" in data
        assert "total_stamp_duty" in data
        assert "total_gst" in data
        assert "total_charges" in data
        assert "trades_count" in data


@pytest.mark.asyncio
async def test_order_modification_and_cancellation():
    """
    Verifies PATCH /orders/{order_id} and DELETE /orders/{order_id}
    without requiring symbol in query parameters (auto-resolved).
    """
    trade_service = get_trade_service()
    account_id = "ACC_ORDER_TEST_7D"
    trade_service.register_account(account_id, initial_deposit=Decimal("500000.00"))

    # Place a resting limit order
    order = Order(
        order_id="ORD_7D_RESTING_1",
        account_id=account_id,
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        product_type=ProductType.CNC,
        price=Decimal("1000.00"),
        quantity=10,
        status=OrderStatus.PENDING,
    )
    trade_service.place_order(order)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Modify price & quantity (symbol omitted)
        modify_res = await client.patch(
            f"/orders/{order.order_id}?account_id={account_id}",
            json={"new_quantity": 8, "new_price": 995.00},
        )
        assert modify_res.status_code == 200
        mod_data = modify_res.json()
        assert mod_data["quantity"] == 8
        assert float(mod_data["price"]) == 995.00

        # 2. Cancel order (symbol omitted)
        cancel_res = await client.delete(
            f"/orders/{order.order_id}?account_id={account_id}"
        )
        assert cancel_res.status_code == 200
        cancel_data = cancel_res.json()
        assert cancel_data["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_portfolio_single_position_square_off():
    """
    Verifies POST /portfolio/squareoff/{symbol} executes an immediate
    closing market order for an active open position.
    """
    trade_service = get_trade_service()
    account_id = "ACC_SQ_TEST_7D"
    trade_service.register_account(account_id, initial_deposit=Decimal("500000.00"))

    # Establish an open MIS long position
    buy_order = Order(
        order_id="ORD_7D_MIS_BUY",
        account_id=account_id,
        symbol="TCS",
        side=Side.BUY,
        order_type=OrderType.MARKET,
        product_type=ProductType.MIS,
        price=Decimal("3000.00"),
        quantity=5,
        status=OrderStatus.PENDING,
    )
    # Seed ask liquidity for TCS
    book = trade_service.matching_engine.get_or_create_book("TCS")
    liq_ask = Order(
        order_id="LIQ_TCS_ASK",
        account_id="EXCHANGE_LIQUIDITY",
        symbol="TCS",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        price=Decimal("3000.00"),
        quantity=10,
        status=OrderStatus.PENDING,
    )
    trade_service.matching_engine.place_order(liq_ask)
    trade_service.place_order(buy_order)

    # Check position exists and is open
    pos = trade_service.position_manager.get_position(account_id, "TCS", ProductType.MIS)
    assert pos is not None
    assert pos.quantity == 5

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger single position square-off
        sq_res = await client.post(
            f"/portfolio/squareoff/TCS?account_id={account_id}"
        )
        assert sq_res.status_code == 200
        sq_data = sq_res.json()
        assert sq_data["status"] == "SQUARED_OFF"
        assert sq_data["symbol"] == "TCS"
        assert sq_data["side"] == "SELL"
        assert sq_data["closed_quantity"] == 5

    # Position should now be flat (0 quantity)
    updated_pos = trade_service.position_manager.get_position(account_id, "TCS", ProductType.MIS)
    assert updated_pos.quantity == 0
