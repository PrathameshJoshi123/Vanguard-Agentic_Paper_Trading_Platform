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
async def test_api_agent_chat_rejection_exit_criteria():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "query": "Buy 1,000,000 shares of Reliance",
            "account_id": "DEFAULT"
        }
        response = await client.post("/agent/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Cannot execute:" in data["response"]
        assert "Order rejected." in data["response"]

@pytest.mark.asyncio
async def test_api_agent_chat_portfolio_explanation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "query": "Why did my portfolio lose money today?",
            "account_id": "DEFAULT"
        }
        response = await client.post("/agent/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Portfolio Health & P&L Analysis" in data["response"]
