import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from src.api.app import app
from src.storage.database import Base, get_db_session


@pytest.fixture(autouse=True)
async def setup_test_sqlite_db():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.mark.asyncio
async def test_market_depth_and_status_endpoints():
    """Verifies Market Data depth and status endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fetch depth for RELIANCE
        res_depth = await client.get("/market/depth/RELIANCE")
        assert res_depth.status_code == 200
        data = res_depth.json()
        assert data["symbol"] == "RELIANCE"
        assert len(data["bids"]) == 5
        assert len(data["asks"]) == 5
        assert data["spread"] >= 0.0

        # 2. Fetch feed status
        res_status = await client.get("/market/status")
        assert res_status.status_code == 200
        status_data = res_status.json()
        assert "feed_mode" in status_data
        assert "health" in status_data

        # 3. Toggle feed mode
        res_toggle = await client.post("/market/feed-mode", json={"mode": "LIVE"})
        assert res_toggle.status_code == 200
        assert res_toggle.json()["feed_mode"] == "LIVE"

        # Toggle back to REPLAY
        res_toggle_back = await client.post("/market/feed-mode", json={"mode": "REPLAY"})
        assert res_toggle_back.status_code == 200
        assert res_toggle_back.json()["feed_mode"] == "REPLAY"


@pytest.mark.asyncio
async def test_system_reconciliation_and_drop_simulation():
    """Verifies audit reconciliation, crash replay, and market drop simulation endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Run audit reconciliation
        res_rec = await client.get("/system/reconcile?account_id=DEFAULT")
        assert res_rec.status_code == 200
        rec_data = res_rec.json()
        assert rec_data["status"] == "BALANCED"
        assert rec_data["discrepancy"] == "0.00"

        # 2. Crash Replay endpoint
        res_crash = await client.post("/system/crash-replay", json={"account_id": "DEFAULT"})
        assert res_crash.status_code == 200
        crash_data = res_crash.json()
        assert crash_data["status"] == "RECOVERED"
        assert crash_data["reconciliation"]["is_balanced"] is True

        # 3. Simulate Drop endpoint
        res_drop = await client.post("/system/simulate-drop", json={"symbol": "RELIANCE", "drop_percentage": 5.0})
        assert res_drop.status_code == 200
        drop_data = res_drop.json()
        assert drop_data["status"] == "DROP_TRIGGERED"
        assert drop_data["drop_percentage"] == 5.0
        assert drop_data["new_price"] < drop_data["old_price"]
