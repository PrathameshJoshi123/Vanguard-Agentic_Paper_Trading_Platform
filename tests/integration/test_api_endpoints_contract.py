from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from src.api.app import app
from src.api.dependencies import get_trade_service, reset_engine_state


@pytest.fixture(autouse=True)
def clean_engine():
    reset_engine_state()
    svc = get_trade_service()
    svc.register_account("ACC_REST_TEST", initial_deposit=Decimal("500000.00"))
    yield
    reset_engine_state()


@pytest.mark.asyncio
async def test_api_rest_endpoints_complete_contract():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # 2. Check initial margin
        res = await client.get("/margin?account_id=ACC_REST_TEST")
        assert res.status_code == 200
        margin_data = res.json()
        assert float(margin_data["cash_balance"]) == 500000.00
        assert float(margin_data["available_margin"]) == 500000.00
        assert float(margin_data["blocked_margin"]) == 0.00

        # 3. Place resting limit BUY order
        order_payload = {
            "symbol": "INFY",
            "side": "BUY",
            "order_type": "LIMIT",
            "quantity": 10,
            "price": "1500.00",
            "product_type": "CNC",
            "account_id": "ACC_REST_TEST",
        }
        res = await client.post("/orders", json=order_payload)
        assert res.status_code == 201
        placed_data = res.json()
        order_id = placed_data["order"]["order_id"]
        assert placed_data["order"]["status"] == "OPEN"
        assert placed_data["order"]["symbol"] == "INFY"

        # 4. Query order by ID and list orders
        res = await client.get(f"/orders/{order_id}")
        assert res.status_code == 200
        assert res.json()["order_id"] == order_id

        res = await client.get("/orders?account_id=ACC_REST_TEST")
        assert res.status_code == 200
        assert len(res.json()) == 1

        # 5. Modify resting order
        modify_payload = {
            "new_quantity": 8,
            "new_price": "1490.00",
        }
        res = await client.patch(f"/orders/{order_id}?account_id=ACC_REST_TEST&symbol=INFY", json=modify_payload)
        assert res.status_code == 200
        assert res.json()["quantity"] == 8
        assert float(res.json()["price"]) == 1490.00

        # 6. Cancel resting order
        res = await client.delete(f"/orders/{order_id}?account_id=ACC_REST_TEST&symbol=INFY")
        assert res.status_code == 200
        assert res.json()["status"] == "CANCELLED"

        # 7. Check margin after cancellation (should be unblocked)
        res = await client.get("/margin?account_id=ACC_REST_TEST")
        assert res.status_code == 200
        assert float(res.json()["blocked_margin"]) == 0.00

        # 8. Check ledger
        res = await client.get("/ledger?account_id=ACC_REST_TEST")
        assert res.status_code == 200
        ledger_data = res.json()
        assert ledger_data["entries_count"] >= 1  # Contains initial deposit
        assert float(ledger_data["running_balance"]) == 500000.00

        # 9. Check positions and holdings
        res = await client.get("/positions?account_id=ACC_REST_TEST")
        assert res.status_code == 200

        res = await client.get("/holdings?account_id=ACC_REST_TEST")
        assert res.status_code == 200
