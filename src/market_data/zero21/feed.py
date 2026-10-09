import asyncio
import json
import logging
from collections import deque
from typing import Callable, Dict, List, Optional, Set, Tuple
import websockets

from src.market_data.models import FeedHealth, FeedStatus, MarketDepth
from src.market_data.sequence_manager import SequenceManager
from src.market_data.zero21.client import Zero21Client
from src.market_data.zero21.config import Zero21Config, zero21_config
from src.market_data.zero21.instruments import InstrumentMaster, instrument_master
from src.market_data.zero21.parser import BinaryPacketParser, binary_packet_parser

logger = logging.getLogger(__name__)


class Zero21MarketFeedHandler:
    """
    Production-Grade Live Market Data WebSocket Feed Handler for 021 Trade Developer Sandbox.
    Features:
      - Authenticated binary connection using dynamic ephemeral keys from Zero21Client.
      - Auto-reconnect with exponential backoff on connection drop or daily 08:00 IST server reset.
      - Ingests Big-Endian binary frames, decodes TC 1 (LTP) and TC 3 (Full 220B NSECM Depth).
      - Integrates with SequenceManager for deduplication, sequence gap tracking, and out-of-order filtering.
      - Dispatches MarketDepth updates to registered subscriber callbacks in sub-millisecond time.
      - Graceful error boundary: never crashes parent application if connection drops or network is offline.
    """

    def __init__(
        self,
        config: Optional[Zero21Config] = None,
        client: Optional[Zero21Client] = None,
        instruments: Optional[InstrumentMaster] = None,
        parser: Optional[BinaryPacketParser] = None,
        sequence_manager: Optional[SequenceManager] = None,
    ):
        self.config = config or zero21_config
        self.client = client or Zero21Client(config=self.config)
        self.instruments = instruments or instrument_master
        self.parser = parser or binary_packet_parser
        self.sequence_manager = sequence_manager or SequenceManager()

        self.status = FeedStatus.DISCONNECTED
        self._subscribed_instruments: Set[Tuple[int, int]] = set()  # (exchange_code, token)
        self._callbacks: List[Callable[[MarketDepth], None]] = []

        self._running = False
        self._ws_task: Optional[asyncio.Task] = None
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._sequence_counter = 0
        self._frame_cache: Dict[bytes, List[MarketDepth]] = {}
        self._frame_cache_queue: deque = deque()

    def add_callback(self, callback: Callable[[MarketDepth], None]) -> None:
        """Registers a callback to receive parsed and validated MarketDepth ticks."""
        self._callbacks.append(callback)

    def subscribe_token(self, token: int, exchange_code: int = 1) -> None:
        """Adds an instrument to subscription list by token and exchange code."""
        self._subscribed_instruments.add((exchange_code, token))
        if self._ws and self._running and not self._ws.closed:
            asyncio.create_task(self._send_subscribe([(exchange_code, token)]))

    def subscribe_symbol(self, symbol: str, exchange_code: int = 1) -> bool:
        """Adds an instrument to subscription list by symbol."""
        token = self.instruments.symbol_to_token(symbol)
        if token is not None:
            self.subscribe_token(token, exchange_code)
            return True
        logger.warning(f"Could not subscribe symbol {symbol}: token not found in InstrumentMaster.")
        return False

    async def _send_subscribe(self, instruments: List[Tuple[int, int]]) -> None:
        """Sends JSON subscription frame over active WebSocket connection."""
        if not self._ws or self._ws.closed:
            return
        # Payload format: {"Task":"subscribe","Mode":"full","Instruments":[[1,2885],...]}
        payload = {
            "Task": "subscribe",
            "Mode": "full",
            "Instruments": [[exch, tok] for exch, tok in instruments],
        }
        try:
            await self._ws.send(json.dumps(payload))
            logger.info(f"Sent 021 market subscribe frame for {len(instruments)} instruments.")
        except Exception as e:
            logger.warning(f"Failed to send 021 subscribe frame: {e}")

    async def start(self) -> None:
        """Starts the persistent background WebSocket worker task."""
        if self._running:
            return
        self._running = True
        self._ws_task = asyncio.create_task(self._run_loop())
        logger.info("Zero21MarketFeedHandler background worker started.")

    async def stop(self) -> None:
        """Gracefully stops the WebSocket feed handler."""
        self._running = False
        if self._ws and not self._ws.closed:
            await self._ws.close()
            self._ws = None
        if self._ws_task and not self._ws_task.done():
            self._ws_task.cancel()
            try:
                await self._ws_task
            except asyncio.CancelledError:
                pass
        self.status = FeedStatus.DISCONNECTED
        logger.info("Zero21MarketFeedHandler stopped.")

    async def _run_loop(self) -> None:
        """Resilient background loop with automatic reconnect and backoff."""
        backoff_seconds = 1.0
        max_backoff = 30.0

        while self._running:
            if not self.config.is_configured:
                logger.info("021 credentials not configured. Zero21MarketFeedHandler idling in disconnected mode.")
                self.status = FeedStatus.DISCONNECTED
                await asyncio.sleep(5.0)
                continue

            try:
                # 1. Fetch fresh ephemeral key
                ephemeral_key = await self.client.get_ephemeral_key()
                ws_url = f"{self.config.ws_base_url}?token={ephemeral_key}"

                logger.info(f"Connecting to 021 market websocket: {self.config.ws_base_url}...")
                async with websockets.connect(
                    ws_url,
                    ping_interval=20,
                    ping_timeout=30,
                    max_size=50000,
                ) as ws:
                    self._ws = ws
                    self.status = FeedStatus.CONNECTED
                    backoff_seconds = 1.0  # Reset backoff on successful connection
                    logger.info("Connected to 021 market data WebSocket.")

                    # 2. Resubscribe all active instruments
                    if self._subscribed_instruments:
                        await self._send_subscribe(list(self._subscribed_instruments))

                    # 3. Message processing loop
                    async for message in ws:
                        if not self._running:
                            break

                        if isinstance(message, bytes):
                            self._process_binary_frame(message)
                        elif isinstance(message, str):
                            # Text frames (snapshot responses or acks)
                            logger.debug(f"Received text frame from 021 socket: {message[:100]}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.status = FeedStatus.DISCONNECTED
                logger.warning(
                    f"021 Market WebSocket connection dropped: {e}. Retrying in {backoff_seconds:.1f}s..."
                )
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 2.0, max_backoff)

    def _process_binary_frame(self, frame_bytes: bytes) -> None:
        """Parses binary packets, validates through SequenceManager, and dispatches to subscribers."""
        if frame_bytes in self._frame_cache:
            depths = self._frame_cache[frame_bytes]
        else:
            self._sequence_counter += 1
            depths = self.parser.parse_frame(frame_bytes, sequence_counter=self._sequence_counter)
            self._frame_cache[frame_bytes] = depths
            self._frame_cache_queue.append(frame_bytes)
            if len(self._frame_cache) > 1000:
                old_frame = self._frame_cache_queue.popleft()
                self._frame_cache.pop(old_frame, None)

        for depth in depths:
            # Validate through SequenceManager (drops duplicate & out-of-order ticks, tracks gaps)
            is_valid, _ = self.sequence_manager.validate_and_record(depth)
            if not is_valid:
                continue

            # Dispatch to subscribers
            for cb in self._callbacks:
                try:
                    cb(depth)
                except Exception as e:
                    logger.exception(f"Error in market depth callback: {e}")

    def get_feed_health(self, symbol: str) -> FeedHealth:
        """Returns sequence and feed health metrics for a symbol."""
        health = self.sequence_manager.get_health(symbol)
        health.status = self.status
        return health
