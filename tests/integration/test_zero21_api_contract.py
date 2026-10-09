from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from src.api.app import app
from src.api.dependencies import get_trade_service, reset_engine_state
from src.common.types import Side, OrderType, OrderStatus, ProductType
from src.core.models import Order


@pytest.fixture(autouse=True)
def clean_engine():
    reset_engine_state()
    svc = get_trade_service()
    svc.register_account("HACK1234", initial_deposit=Decimal("1000000.00"))
    yield
    reset_engine_state()


@pytest.mark.asyncio
async def test_zero21_auth_and_instruments_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. POST /api/developer-api/v1/auth/token
        login_res = await client.post(
            "/api/developer-api/v1/auth/token",
            json={"username": "HACK1234", "password": "Password123"},
        )
        assert login_res.status_code == 200
        auth_data = login_res.json()
        assert auth_data["success"] is True
        token = auth_data["data"]["accessToken"]
        assert token.startswith("bearer_HACK1234")

        # 2. GET /api/developer-api/v1/websocket/ephemeral-key
        headers = {"Authorization": f"Bearer {token}"}
        key_res = await client.get("/api/developer-api/v1/websocket/ephemeral-key", headers=headers)
        assert key_res.status_code == 200
        key_data = key_res.json()
        assert key_data["success"] is True
        assert key_data["data"]["token"] == "mock_ephemeral_key_24h"

        # 3. GET /api/developer-api/v1/instruments
        inst_res = await client.get("/api/developer-api/v1/instruments", headers=headers)
        assert inst_res.status_code == 200
        csv_text = inst_res.text
        assert "token,exchange" in csv_text
        assert "RELIANCE" in csv_text
        assert "TCS" in csv_text


@pytest.mark.asyncio
async def test_zero21_order_lifecycle_contract():
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer HACK1234"}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Place Resting Limit BUY Order (RL)
        # RELIANCE token=2885, buy 10 @ 2500.00 (250000 paise)
        place_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": 10,
            "price": 250000,
            "book": "RL",
            "product": "INTRADAY",
            "validity": "Day",
        }
        res = await client.post("/api/developer-api/v1/orders", json=place_payload, headers=headers)
        assert res.status_code == 200
        envelope = res.json()
        assert envelope["success"] is True
        assert envelope["data"]["type"] == "SUCCESS"
        order_id = envelope["data"]["orderId"]

        # 2. List Orders (GET /orders) -> Plain JSON Array
        res = await client.get("/api/developer-api/v1/orders", headers=headers)
        assert res.status_code == 200
        orders_list = res.json()
        assert isinstance(orders_list, list)
        assert len(orders_list) >= 1
        found = next(o for o in orders_list if str(o["orderId"]) == str(order_id))
        assert found["token"] == 2885
        assert found["qtyRemaining"] == 10
        assert found["price"] == 250000
        assert found["book"] == "RL"
        assert found["product"] == "INTRADAY"

        # 3. Get Single Order (GET /orders/{order_id}) -> 1-element array
        res = await client.get(f"/api/developer-api/v1/orders/{order_id}", headers=headers)
        assert res.status_code == 200
        single_arr = res.json()
        assert isinstance(single_arr, list)
        assert len(single_arr) == 1
        assert str(single_arr[0]["orderId"]) == str(order_id)

        # 4. Modify Order (PUT /orders/{order_id})
        modify_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": 8,
            "price": 249000,
            "book": "RL",
            "product": "INTRADAY",
            "validity": "Day",
        }
        res = await client.put(f"/api/developer-api/v1/orders/{order_id}", json=modify_payload, headers=headers)
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Check modified values
        res = await client.get(f"/api/developer-api/v1/orders/{order_id}", headers=headers)
        assert res.json()[0]["qtyRemaining"] == 8
        assert res.json()[0]["price"] == 249000

        # 5. Cancel Order (DELETE /orders/{order_id})
        res = await client.delete(f"/api/developer-api/v1/orders/{order_id}", headers=headers)
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Order must now reflect Cancelled status
        res = await client.get(f"/api/developer-api/v1/orders/{order_id}", headers=headers)
        assert res.json()[0]["status"] == "Cancelled"
        assert res.json()[0]["qtyRemaining"] == 0


@pytest.mark.asyncio
async def test_zero21_trade_execution_and_portfolio_endpoints():
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer HACK1234"}
    svc = get_trade_service()

    # Pre-seed resting sell order on RELIANCE so buyer gets immediate fill
    maker_sell = Order(
        order_id="ORD_MAKER_1",
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        quantity=20,
        price=Decimal("2500.00"),
        product_type=ProductType.CNC,
        account_id="MAKER_ACC",
        status=OrderStatus.PENDING,
    )
    maker_acc = svc.register_account("MAKER_ACC", initial_deposit=Decimal("500000.00"))
    maker_acc.holdings["RELIANCE"] = 50
    svc.position_manager._sync_cnc_holding("MAKER_ACC", "RELIANCE", Side.BUY, 50, Decimal("2500.00"))
    svc.place_order(maker_sell)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Place Market BUY order for RELIANCE (token=2885, price=0, product=CNC)
        buy_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": 10,
            "price": 0,  # Market order
            "book": "RL",
            "product": "CNC",
            "validity": "Day",
        }
        res = await client.post("/api/developer-api/v1/orders", json=buy_payload, headers=headers)
        assert res.status_code == 200
        assert res.json()["success"] is True
        buy_order_id = res.json()["data"]["orderId"]

        # Check trades (GET /trades)
        res = await client.get("/api/developer-api/v1/trades", headers=headers)
        assert res.status_code == 200
        trades = res.json()
        assert len(trades) >= 1
        assert trades[0]["token"] == 2885
        assert trades[0]["quantity"] == 10
        assert trades[0]["price"] == 250000  # 2500.00 in paise

        # Check order trades (GET /orders/{orderId}/trades)
        res = await client.get(f"/api/developer-api/v1/orders/{buy_order_id}/trades", headers=headers)
        assert res.status_code == 200
        order_trades = res.json()
        assert len(order_trades) == 1
        assert order_trades[0]["quantity"] == 10

        # Check positions (GET /portfolio/positions)
        res = await client.get("/api/developer-api/v1/portfolio/positions", headers=headers)
        assert res.status_code == 200
        positions = res.json()
        assert len(positions) >= 1
        rel_pos = next(p for p in positions if p["token"] == 2885)
        assert rel_pos["netQuantity"] == 10
        assert rel_pos["netPrice"] == 250000
        assert rel_pos["squareOffQuantity"] == -10
        assert rel_pos["longPosition"] is True

        # Check holdings (GET /portfolio/holdings) for CNC
        res = await client.get("/api/developer-api/v1/portfolio/holdings", headers=headers)
        assert res.status_code == 200
        holdings = res.json()
        assert len(holdings) >= 1
        rel_h = next(h for h in holdings if h["symbol"] == "RELIANCE")
        assert rel_h["freeQty"] == 10
        assert rel_h["price"] == 250000


@pytest.mark.asyncio
async def test_zero21_risk_rejection_insufficient_margin():
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer HACK1234"}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Place gigantic order exceeding ₹10,00,000 virtual balance
        # 10,000 shares @ ₹2500 = ₹2,50,00,000 (2.5 Crore)
        oversized_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": 10000,
            "price": 250000,
            "book": "RL",
            "product": "CNC",
            "validity": "Day",
        }
        res = await client.post("/api/developer-api/v1/orders", json=oversized_payload, headers=headers)
        assert res.status_code == 200
        envelope = res.json()
        # Must be rejected with success: false in envelope
        assert envelope["success"] is False
        assert envelope["data"] is None
        assert "Insufficient funds" in envelope["error"]
