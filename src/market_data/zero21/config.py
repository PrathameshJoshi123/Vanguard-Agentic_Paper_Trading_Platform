import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Zero21Config(BaseSettings):
    """
    Configuration for 021 Trade Developer Sandbox REST and WebSocket APIs.
    Loads credentials and endpoints from environment variables or .env file.
    """
    ucc: str = Field(default_factory=lambda: os.getenv("ZERO21_UCC", ""))
    password: str = Field(default_factory=lambda: os.getenv("ZERO21_PASSWORD", ""))
    access_token: str = Field(default_factory=lambda: os.getenv("ZERO21_ACCESS_TOKEN", ""))
    base_url: str = Field(
        default_factory=lambda: os.getenv(
            "ZERO21_BASE_URL", "https://devapi.021.trade/api/developer-api/v1"
        ).rstrip("/")
    )
    ws_base_url: str = Field(
        default_factory=lambda: os.getenv(
            "ZERO21_WS_BASE_URL", "wss://devapi.021.trade/api/developer/websocket/market"
        )
    )
    instruments_cache_path: str = Field(default="data/instruments.csv")
    token_cache_path: str = Field(default="data/zero21_token.json")
    request_timeout_seconds: float = Field(default=15.0)

    @property
    def is_configured(self) -> bool:
        """Returns True if credentials (UCC and password) or direct access_token are supplied."""
        return bool((self.ucc.strip() and self.password.strip()) or self.access_token.strip())


    class Config:
        env_file = ".env"
        extra = "ignore"


zero21_config = Zero21Config()
