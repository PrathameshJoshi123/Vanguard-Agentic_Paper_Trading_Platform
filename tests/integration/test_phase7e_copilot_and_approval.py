from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from src.api.app import app
from src.api.dependencies import get_trade_service, reset_engine_state

@pytest.fixture(autouse=True)
def clean_engine():
    reset_engine_state()
    svc = get_trade_service()
    svc.register_account("DEFAULT", initial_deposit=Decimal("1000000.00"))
    yield
    reset_engine_state()

@pytest.mark.asyncio
async def test_phase7e_copilot_research_citations():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "query": "Research RELIANCE share price and latest news catalysts",
            "account_id": "DEFAULT"
        }
        res = await client.post("/api/v1/agent/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["agent_routed"] == "research"
        assert "response" in data
        assert isinstance(data["citations"], list)

@pytest.mark.asyncio
async def test_phase7e_copilot_policy_firewall_rejection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "query": "Buy 1,000,000 shares of Reliance",
            "account_id": "DEFAULT"
        }
        res = await client.post("/api/v1/agent/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["agent_routed"] == "proposer"
        assert data["policy_result"] is not None
        assert data["policy_result"]["status"] == "REJECTED"
        assert "exceeds maximum allowed position size" in data["policy_result"]["reason"]

@pytest.mark.asyncio
async def test_phase7e_copilot_compliant_proposal_and_execution():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Propose compliant trade
        payload = {
            "query": "Propose buying 10 shares of TCS at 3500 CNC",
            "account_id": "DEFAULT"
        }
        res = await client.post("/api/v1/agent/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["agent_routed"] == "proposer"
        assert data["policy_result"] is not None
        assert data["policy_result"]["status"] == "NEEDS_APPROVAL"
        
        order_payload = data["policy_result"]["order_payload"]
        assert order_payload["symbol"] == "TCS"
        assert order_payload["quantity"] == 10

        # 2. Execute approved proposal via Human Approval Gateway
        exec_payload = {
            "account_id": "DEFAULT",
            "symbol": order_payload["symbol"],
            "side": order_payload["side"],
            "quantity": order_payload["quantity"],
            "price": order_payload["price"],
            "order_type": order_payload["order_type"],
            "product_type": order_payload["product_type"]
        }
        exec_res = await client.post("/api/v1/agent/execute-proposed", json=exec_payload)
        assert exec_res.status_code == 200
        exec_data = exec_res.json()
        assert "order_id" in exec_data
        assert exec_data["symbol"] == "TCS"
        assert exec_data["side"] == "BUY"

@pytest.mark.asyncio
async def test_phase7e_what_if_simulation_and_drop():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Run What-If simulation
        sim_payload = {
            "account_id": "DEFAULT",
            "scenarios": [
                {
                    "symbol": "RELIANCE",
                    "price_change_pct": -5.0
                }
            ]
        }
        sim_res = await client.post("/api/v1/agent/simulate", json=sim_payload)
        assert sim_res.status_code == 200
        sim_data = sim_res.json()
        assert "projected_pnl_delta" in sim_data
        assert "risk_assessment" in sim_data

        # 2. Simulate drop tick
        drop_res = await client.post(
            "/api/v1/system/simulate-drop",
            json={"symbol": "RELIANCE", "drop_percentage": 5.0}
        )
        assert drop_res.status_code == 200
        drop_data = drop_res.json()
        assert drop_data["status"] == "DROP_TRIGGERED"
        assert drop_data["symbol"] == "RELIANCE"
