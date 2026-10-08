import asyncio
import logging
from typing import AsyncGenerator, Dict, List, Optional
import httpx

from src.market_data.models import FeedStatus, MarketDepth
from src.market_data.normalizer import MarketDepthNormalizer

logger = logging.getLogger(__name__)


class LiveNSEFeedHandler:
    """
    Live Market Data Feed Handler fetching equity quotes & Top-5 depth from NSE India.
    Features:
      - Realistic browser headers to maintain session validity.
      - Automatic cookie initialization and refresh.
      - Non-crashing error handling when markets are closed, rate-limited, or network drops.
    """

    BASE_URL = "https://www.nseindia.com"
    QUOTE_ENDPOINT = "https://www.nseindia.com/api/quote-equity?symbol={symbol}"

    DEFAULT_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.nseindia.com/",
    }

    API_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/get-quotes/equity?symbol=",
    }

    def __init__(self, poll_interval_seconds: float = 1.0):
        self.poll_interval = poll_interval_seconds
        self.status = FeedStatus.DISCONNECTED
        self._client: Optional[httpx.AsyncClient] = None
        self._session_initialized = False

    async def _init_session(self) -> bool:
        """Visits NSE homepage to initialize cookies."""
        try:
            if self._client is None:
                self._client = httpx.AsyncClient(
                    headers=self.DEFAULT_HEADERS,
                    timeout=httpx.Timeout(10.0),
                    follow_redirects=True,
                )
            resp = await self._client.get(self.BASE_URL)
            if resp.status_code == 200:
                self._session_initialized = True
                self.status = FeedStatus.CONNECTED
                return True
        except Exception as e:
            logger.warning(f"Failed to initialize NSE cookie session: {e}")
            self.status = FeedStatus.DISCONNECTED
        return False

    async def fetch_quote(self, symbol: str) -> Optional[MarketDepth]:
        """Fetches a single quote and market depth update for a symbol using nsepython."""
        sym = symbol.upper()
        # 1. Primary: Use nsepython package directly in worker thread
        try:
            import nsepython
            raw_quote = await asyncio.to_thread(nsepython.nse_quote, sym)
            if raw_quote and isinstance(raw_quote, dict):
                depth = MarketDepthNormalizer.normalize_nse_quote(sym, raw_quote)
                self.status = FeedStatus.CONNECTED
                return depth
        except Exception as e:
            logger.debug(f"nsepython call failed for {sym}: {e}. Trying fallback client.")

        # 2. Resilient fallback: Direct httpx client
        if not self._session_initialized:
            success = await self._init_session()
            if not success:
                return None

        url = self.QUOTE_ENDPOINT.format(symbol=sym)
        headers = dict(self.API_HEADERS)
        headers["Referer"] = f"https://www.nseindia.com/get-quotes/equity?symbol={sym}"

        try:
            assert self._client is not None
            resp = await self._client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                self.status = FeedStatus.CONNECTED
                return MarketDepthNormalizer.normalize_nse_quote(sym, data)
            elif resp.status_code in (401, 403):
                self._session_initialized = False
                await self._init_session()
        except Exception as e:
            logger.warning(f"Error fetching live NSE quote for {sym}: {e}")
            self.status = FeedStatus.DISCONNECTED

        return None


    async def stream_live_symbol(
        self, symbol: str, max_ticks: Optional[int] = None
    ) -> AsyncGenerator[MarketDepth, None]:
        """Continuously streams ticks for a symbol at poll_interval_seconds."""
        ticks_yielded = 0
        while max_ticks is None or ticks_yielded < max_ticks:
            depth = await self.fetch_quote(symbol)
            if depth:
                ticks_yielded += 1
                yield depth
            await asyncio.sleep(self.poll_interval)

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
            self._session_initialized = False
            self.status = FeedStatus.DISCONNECTED
