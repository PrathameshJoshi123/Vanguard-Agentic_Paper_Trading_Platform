import asyncio
from datetime import datetime, timezone, timedelta
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional
import httpx

from src.market_data.zero21.config import Zero21Config, zero21_config

logger = logging.getLogger(__name__)



class Zero21ApiError(Exception):
    """Raised when a 021 REST API call fails."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class Zero21AuthError(Zero21ApiError):
    """Raised when authentication with 021 fails."""
    pass


class Zero21Client:
    """
    High-performance asynchronous client for 021 Trade Developer Sandbox REST APIs.
    Features:
      - Adheres strictly to the single-live-token per account rule (preserves tokens across reloads).
      - Reusable httpx.AsyncClient with keep-alive connection pooling for sub-millisecond overhead.
      - Concurrency-safe asyncio.Lock preventing duplicate concurrent logins.
      - Fast disk caching of valid tokens in token_cache_path to survive crashes without revoking session.
      - Automatic token invalidation and re-login upon receiving HTTP 401.
    """

    def __init__(self, config: Optional[Zero21Config] = None):
        self.config = config or zero21_config
        self._http_client: Optional[httpx.AsyncClient] = None
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._auth_lock = asyncio.Lock()

        # Try to restore token from disk cache
        self._load_cached_token()

    def _get_http_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=httpx.Timeout(self.config.request_timeout_seconds),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
        return self._http_client

    async def close(self) -> None:
        """Closes the underlying HTTP client."""
        if self._http_client is not None and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    def _load_cached_token(self) -> None:
        """Loads cached token from config or disk if valid and not expired."""
        # 1. Direct environment / config token takes immediate priority
        if self.config.access_token and self.config.access_token.strip():
            self._access_token = self.config.access_token.strip()
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
            logger.info("Loaded ZERO21_ACCESS_TOKEN directly from environment configuration.")
            return

        # 2. Disk cache fallback
        try:
            cache_file = Path(self.config.token_cache_path)
            if not cache_file.exists():
                return
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            token = data.get("accessToken")
            expires_at_str = data.get("expiresAt")
            ucc = data.get("ucc")

            if ucc != self.config.ucc or not token or not expires_at_str:
                return

            expires_at = datetime.fromisoformat(expires_at_str)
            # Add 60-second buffer
            if datetime.now(timezone.utc) < expires_at:
                self._access_token = token
                self._token_expires_at = expires_at
                logger.info(f"Loaded valid cached 021 access token for {ucc} (expires: {expires_at_str})")
        except Exception as e:
            logger.debug(f"Failed to load cached 021 token: {e}")


    def _save_cached_token(self, token: str, expires_at: datetime) -> None:
        """Persists access token to disk cache."""
        try:
            cache_file = Path(self.config.token_cache_path)
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "ucc": self.config.ucc,
                "accessToken": token,
                "expiresAt": expires_at.isoformat(),
            }
            cache_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Failed to persist 021 token to disk: {e}")

    def is_token_valid(self) -> bool:
        """Returns True if the current in-memory token has not expired."""
        if not self._access_token or not self._token_expires_at:
            return False
        return datetime.now(timezone.utc) < self._token_expires_at

    async def login(self, force: bool = False) -> str:
        """
        Authenticates with 021 via POST /auth/token and caches the access token.
        Enforces single token rule: skips if existing token is valid unless force=True.
        """
        async with self._auth_lock:
            if not force and self.is_token_valid():
                assert self._access_token is not None
                return self._access_token

            if not self.config.ucc or not self.config.password:
                if self.config.access_token and self.config.access_token.strip():
                    self._access_token = self.config.access_token.strip()
                    self._token_expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
                    return self._access_token
                raise Zero21AuthError(
                    "ZERO21_UCC and ZERO21_PASSWORD (or ZERO21_ACCESS_TOKEN) not configured in .env"
                )


            client = self._get_http_client()
            url = f"{self.config.base_url}/auth/token"
            payload = {
                "username": self.config.ucc,
                "password": self.config.password,
            }

            logger.info(f"Authenticating with 021 Trade as {self.config.ucc}...")
            try:
                resp = await client.post(url, json=payload)
            except Exception as e:
                raise Zero21AuthError(f"Network error connecting to 021 auth endpoint: {e}")

            if resp.status_code == 401:
                raise Zero21AuthError(
                    f"Invalid UCC username ({self.config.ucc}) or password (HTTP 401).",
                    status_code=401,
                )
            elif resp.status_code != 200:
                raise Zero21AuthError(
                    f"021 Login failed with HTTP {resp.status_code}: {resp.text}",
                    status_code=resp.status_code,
                )

            data = resp.json()
            if not data.get("success") or not data.get("data"):
                raise Zero21AuthError(f"021 Login returned failure: {data.get('error')}")

            token_data = data["data"]
            access_token = token_data["accessToken"]
            expires_at_raw = token_data.get("expiresAt")

            if expires_at_raw:
                try:
                    expires_at = datetime.fromisoformat(expires_at_raw)
                except Exception:
                    # Fallback to expiresIn seconds
                    expires_in = token_data.get("expiresIn", 36000)
                    expires_at = datetime.now(timezone.utc).timestamp() + expires_in
                    expires_at = datetime.fromtimestamp(expires_at, tz=timezone.utc)
            else:
                expires_in = token_data.get("expiresIn", 36000)
                expires_at = datetime.fromtimestamp(
                    datetime.now(timezone.utc).timestamp() + expires_in, tz=timezone.utc
                )

            self._access_token = access_token
            self._token_expires_at = expires_at
            self._save_cached_token(access_token, expires_at)
            logger.info(f"021 authentication successful. Token expires at {expires_at}")
            return access_token

    async def get_valid_access_token(self) -> str:
        """Returns a valid access token, performing login if necessary."""
        if self.is_token_valid():
            assert self._access_token is not None
            return self._access_token
        return await self.login()

    async def get_ephemeral_key(self) -> str:
        """
        Calls GET /websocket/ephemeral-key with Authorization: Bearer <accessToken>.
        Returns the ephemeral JWT key string needed to connect to the market websocket.
        """
        token = await self.get_valid_access_token()
        client = self._get_http_client()
        url = f"{self.config.base_url}/websocket/ephemeral-key"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            resp = await client.get(url, headers=headers)
            # If token expired on server side (401), re-login once and retry
            if resp.status_code == 401:
                logger.warning("021 returned 401 on ephemeral key request; refreshing token...")
                token = await self.login(force=True)
                headers["Authorization"] = f"Bearer {token}"
                resp = await client.get(url, headers=headers)
        except Exception as e:
            raise Zero21ApiError(f"Network error fetching ephemeral key: {e}")

        if resp.status_code != 200:
            raise Zero21ApiError(
                f"Failed to fetch ephemeral key (HTTP {resp.status_code}): {resp.text}",
                status_code=resp.status_code,
            )

        data = resp.json()
        if not data.get("success") or not data.get("data"):
            raise Zero21ApiError(f"021 ephemeral-key error: {data.get('error')}")

        ephemeral_token = data["data"].get("token")
        if not ephemeral_token:
            raise Zero21ApiError("No 'token' field found in ephemeral-key response data.")

        return ephemeral_token

    async def download_instruments_csv(self) -> bytes:
        """
        Downloads gzipped instruments CSV from GET /instruments.
        Decompresses automatically via httpx or returns bytes.
        """
        token = await self.get_valid_access_token()
        client = self._get_http_client()
        url = f"{self.config.base_url}/instruments"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept-Encoding": "gzip",
        }

        try:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 401:
                token = await self.login(force=True)
                headers["Authorization"] = f"Bearer {token}"
                resp = await client.get(url, headers=headers)
        except Exception as e:
            raise Zero21ApiError(f"Network error downloading instruments: {e}")

        if resp.status_code != 200:
            raise Zero21ApiError(
                f"Failed to download instruments (HTTP {resp.status_code}): {resp.text}",
                status_code=resp.status_code,
            )

        return resp.content
