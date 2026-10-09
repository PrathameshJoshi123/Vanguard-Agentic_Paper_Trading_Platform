from datetime import datetime, timezone, timedelta
import json
from pathlib import Path
import pytest
import httpx

from src.market_data.zero21.config import Zero21Config
from src.market_data.zero21.client import (
    Zero21Client,
    Zero21AuthError,
    Zero21ApiError,
)


@pytest.fixture
def mock_config(tmp_path: Path) -> Zero21Config:
    return Zero21Config(
        ucc="HACK9999",
        password="SecretPassword123",
        base_url="https://mock.021.trade/api/developer-api/v1",
        ws_base_url="wss://mock.021.trade/api/developer/websocket/market",
        instruments_cache_path=str(tmp_path / "instruments.csv"),
        token_cache_path=str(tmp_path / "zero21_token.json"),
    )


@pytest.mark.asyncio
async def test_zero21_client_login_success(mock_config: Zero21Config):
    future_time = (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat()
    mock_response = {
        "data": {
            "accessToken": "mock_jwt_token_8f2c",
            "tokenType": "Bearer",
            "expiresAt": future_time,
            "expiresIn": 36000,
        },
        "success": True,
        "error": None,
    }

    def handler(request: httpx.Request):
        assert request.url.path == "/api/developer-api/v1/auth/token"
        req_data = json.loads(request.content.decode())
        assert req_data["username"] == "HACK9999"
        assert req_data["password"] == "SecretPassword123"
        return httpx.Response(200, json=mock_response)

    transport = httpx.MockTransport(handler)
    client = Zero21Client(config=mock_config)
    client._http_client = httpx.AsyncClient(
        base_url=mock_config.base_url,
        transport=transport,
    )

    token = await client.login()
    assert token == "mock_jwt_token_8f2c"
    assert client.is_token_valid() is True

    # Single token rule check: second call must reuse token and not re-hit API
    token2 = await client.get_valid_access_token()
    assert token2 == "mock_jwt_token_8f2c"

    # Disk cache check: cache file must exist with saved token
    cache_file = Path(mock_config.token_cache_path)
    assert cache_file.exists()
    cached = json.loads(cache_file.read_text())
    assert cached["accessToken"] == "mock_jwt_token_8f2c"

    await client.close()


@pytest.mark.asyncio
async def test_zero21_client_login_invalid_credentials(mock_config: Zero21Config):
    def handler(request: httpx.Request):
        return httpx.Response(
            401,
            json={"data": None, "success": False, "error": "Invalid username or password."},
        )

    transport = httpx.MockTransport(handler)
    client = Zero21Client(config=mock_config)
    client._http_client = httpx.AsyncClient(
        base_url=mock_config.base_url,
        transport=transport,
    )

    with pytest.raises(Zero21AuthError) as exc_info:
        await client.login(force=True)

    assert exc_info.value.status_code == 401
    await client.close()


@pytest.mark.asyncio
async def test_zero21_client_get_ephemeral_key(mock_config: Zero21Config):
    future_time = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()

    def handler(request: httpx.Request):
        if request.url.path == "/api/developer-api/v1/auth/token":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "accessToken": "valid_token_xyz",
                        "tokenType": "Bearer",
                        "expiresAt": future_time,
                        "expiresIn": 18000,
                    },
                    "success": True,
                    "error": None,
                },
            )
        elif request.url.path == "/api/developer-api/v1/websocket/ephemeral-key":
            assert request.headers.get("authorization") == "Bearer valid_token_xyz"
            return httpx.Response(
                200,
                json={
                    "data": {"token": "ephemeral_jwt_key_999"},
                    "success": True,
                    "error": None,
                },
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client = Zero21Client(config=mock_config)
    client._http_client = httpx.AsyncClient(
        base_url=mock_config.base_url,
        transport=transport,
    )

    ephemeral_key = await client.get_ephemeral_key()
    assert ephemeral_key == "ephemeral_jwt_key_999"
    await client.close()


@pytest.mark.asyncio
async def test_zero21_client_reauth_on_401(mock_config: Zero21Config):
    # Simulate valid in-memory token that gets rejected by server as 401
    client = Zero21Client(config=mock_config)
    client._access_token = "stale_token"
    client._token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    login_calls = 0

    def handler(request: httpx.Request):
        nonlocal login_calls
        if request.url.path == "/api/developer-api/v1/websocket/ephemeral-key":
            auth = request.headers.get("authorization")
            if auth == "Bearer stale_token":
                return httpx.Response(401, json={"data": None, "success": False, "error": "Invalid token."})
            elif auth == "Bearer fresh_token_123":
                return httpx.Response(200, json={"data": {"token": "fresh_ephemeral_key"}, "success": True})
        elif request.url.path == "/api/developer-api/v1/auth/token":
            login_calls += 1
            return httpx.Response(
                200,
                json={
                    "data": {
                        "accessToken": "fresh_token_123",
                        "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
                    },
                    "success": True,
                },
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client._http_client = httpx.AsyncClient(
        base_url=mock_config.base_url,
        transport=transport,
    )

    ephemeral_key = await client.get_ephemeral_key()
    assert ephemeral_key == "fresh_ephemeral_key"
    assert login_calls == 1
    assert client._access_token == "fresh_token_123"

    await client.close()


@pytest.mark.asyncio
async def test_zero21_client_direct_access_token_configured(tmp_path: Path):
    config = Zero21Config(
        access_token="direct_custom_token_999",
        base_url="https://mock.021.trade/api/developer-api/v1",
        ws_base_url="wss://mock.021.trade/api/developer/websocket/market",
        instruments_cache_path=str(tmp_path / "instruments.csv"),
        token_cache_path=str(tmp_path / "zero21_token.json"),
    )
    client = Zero21Client(config=config)

    # Token is pre-loaded immediately
    assert client.is_token_valid() is True
    assert client._access_token == "direct_custom_token_999"

    token = await client.get_valid_access_token()
    assert token == "direct_custom_token_999"
    await client.close()

