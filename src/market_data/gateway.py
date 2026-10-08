import asyncio
import logging
from typing import Callable, Dict, List, Optional

from src.market_data.models import FeedHealth, FeedStatus, MarketDepth
from src.market_data.normalizer import MarketDepthNormalizer
from src.market_data.sequence_manager import SequenceManager
from src.market_data.replay_engine import ReplayEngine
from src.market_data.live_feed import LiveNSEFeedHandler
from src.market_data.depth_matcher import MarketDepthMatcher, TriggeredOrderResult

from src.events.bus import InMemoryEventBus, default_event_bus
from src.events.models import DomainEvent, DomainEventType
from src.portfolio.position_manager import PositionManager
import uuid

logger = logging.getLogger(__name__)


class MarketDataGateway:
    """
    Unified Dual-Mode Market Data Gateway:
      - Live Mode: Connects to Live NSE quote endpoint.
      - Replay Mode: Reads historical ticks from .jsonl file with configurable speed.
      - Sequence & Resilience Management: Drops duplicates, checks order, tracks gaps.
      - Integrates with MarketDepthMatcher to trigger SL/SL-M orders and cross resting limits.
      - Publishes TICK_RECEIVED and updates position MTM.
    """

    def __init__(
        self,
        replay_mode: bool = True,
        replay_file_path: Optional[str] = None,
        replay_speed_multiplier: Optional[float] = None,
        depth_matcher: Optional[MarketDepthMatcher] = None,
        event_bus: Optional[InMemoryEventBus] = None,
        position_manager: Optional[PositionManager] = None,
    ):
        self.replay_mode = replay_mode
        self.replay_file_path = replay_file_path
        self.replay_speed_multiplier = replay_speed_multiplier
        self.depth_matcher = depth_matcher
        self.event_bus = event_bus if event_bus is not None else default_event_bus
        self.position_manager = position_manager

        self.sequence_manager = SequenceManager()
        self.live_feed = LiveNSEFeedHandler()
        self.replay_engine: Optional[ReplayEngine] = None

        if self.replay_file_path:
            self.replay_engine = ReplayEngine(
                file_path=self.replay_file_path,
                speed_multiplier=self.replay_speed_multiplier,
            )


        # symbol -> latest MarketDepth
        self._latest_depths: Dict[str, MarketDepth] = {}
        # symbol -> list of callbacks(MarketDepth)
        self._subscribers: Dict[str, List[Callable[[MarketDepth], None]]] = {}

        self._running = False
        self._task: Optional[asyncio.Task] = None

    def subscribe(self, symbol: str, callback: Callable[[MarketDepth], None]) -> None:
        sym = symbol.upper()
        if sym not in self._subscribers:
            self._subscribers[sym] = []
        self._subscribers[sym].append(callback)

    @property
    def is_running(self) -> bool:
        return self._running

    def get_latest_depth(self, symbol: str) -> MarketDepth:
        sym = symbol.upper()
        if sym in self._latest_depths:
            return self._latest_depths[sym]
        from src.market_data.models import DepthLevel
        from datetime import datetime, timezone
        from decimal import Decimal
        base_price = Decimal("2500.00") if sym == "RELIANCE" else (Decimal("3500.00") if sym == "TCS" else Decimal("1800.00"))
        default_depth = MarketDepth(
            symbol=sym,
            ltp=base_price,
            bids=[
                DepthLevel(price=base_price - Decimal("0.50") * (i + 1), quantity=100 * (i + 1), orders=i + 1)
                for i in range(5)
            ],
            asks=[
                DepthLevel(price=base_price + Decimal("0.50") * (i + 1), quantity=150 * (i + 1), orders=i + 1)
                for i in range(5)
            ],
            total_buy_quantity=15000,
            total_sell_quantity=17000,
            volume=500000,
            timestamp=datetime.now(timezone.utc),
            sequence_id=0,
        )
        self._latest_depths[sym] = default_depth
        return default_depth

    async def switch_feed_mode(
        self,
        replay_mode: bool,
        replay_file_path: Optional[str] = None,
        symbols: Optional[List[str]] = None,
    ) -> None:
        """Dynamically switches between LIVE NSE feed and OFFLINE REPLAY."""
        was_running = self._running
        if was_running:
            await self.stop()
        self.replay_mode = replay_mode
        if replay_file_path:
            self.replay_file_path = replay_file_path
            self.replay_engine = ReplayEngine(
                file_path=self.replay_file_path,
                speed_multiplier=self.replay_speed_multiplier,
            )
        if was_running:
            await self.start(symbols)

    def get_feed_health(self, symbol: str) -> FeedHealth:
        return self.sequence_manager.get_health(symbol)

    async def ingest_tick(self, depth: MarketDepth) -> List[TriggeredOrderResult]:
        """
        Validates the incoming tick and routes it to depth matcher and subscribers.
        """
        valid, reason = self.sequence_manager.validate_and_record(depth)
        if not valid:
            logger.debug(f"Tick dropped: {reason}")
            return []

        sym = depth.symbol.upper()
        self._latest_depths[sym] = depth

        # Update MTM in position manager
        if self.position_manager:
            self.position_manager.update_market_price(sym, depth.ltp)

        # Emit TICK_RECEIVED event non-blockingly
        if self.event_bus:
            self.event_bus.publish_nowait(
                DomainEvent(
                    event_id=f"EVT_{uuid.uuid4().hex[:12]}",
                    event_type=DomainEventType.TICK_RECEIVED,
                    entity_type="MARKET",
                    entity_id=sym,
                    payload={
                        "symbol": sym,
                        "ltp": float(depth.ltp),
                        "volume": depth.volume,
                        "timestamp": depth.timestamp.isoformat(),
                        "bids": [{"price": float(b.price), "quantity": b.quantity} for b in depth.bids[:5]],
                        "asks": [{"price": float(a.price), "quantity": a.quantity} for a in depth.asks[:5]],
                    },
                )
            )

        # Trigger SL orders and cross resting limit orders
        triggered_results: List[TriggeredOrderResult] = []
        if self.depth_matcher:
            triggered_results = self.depth_matcher.on_market_depth(depth)

        # Notify external subscribers
        for cb in self._subscribers.get(sym, []):
            try:
                cb(depth)
            except Exception as e:
                logger.error(f"Error in subscriber callback for {sym}: {e}")

        return triggered_results

    async def run_replay(self) -> int:
        """Runs the historical replay continuously while running."""
        if not self.replay_engine:
            raise ValueError("Replay file path must be configured for replay mode.")

        ticks_processed = 0
        if not self._running:
            # Standalone single-pass replay execution (e.g. deterministic testing)
            self._running = True
            try:
                async for depth in self.replay_engine.stream_ticks():
                    await self.ingest_tick(depth)
                    ticks_processed += 1
            finally:
                self._running = False
            return ticks_processed

        while self._running:
            async for depth in self.replay_engine.stream_ticks():
                if not self._running:
                    break
                await self.ingest_tick(depth)
                ticks_processed += 1
            if not self._running:
                break
            await asyncio.sleep(1.0)
        return ticks_processed

    async def start(self, symbols: Optional[List[str]] = None) -> None:
        """Starts background feed consumption."""
        self._running = True
        if self.replay_mode:
            self._task = asyncio.create_task(self.run_replay())
        else:
            if not symbols:
                symbols = ["RELIANCE"]
            self._task = asyncio.create_task(self._run_live_loop(symbols))

    async def _run_live_loop(self, symbols: List[str]) -> None:
        """Runs the live polling loop across subscribed symbols."""
        while self._running:
            for sym in symbols:
                depth = await self.live_feed.fetch_quote(sym)
                if depth:
                    await self.ingest_tick(depth)
            await asyncio.sleep(self.live_feed.poll_interval)

    async def stop(self) -> None:
        """Stops background feed processing and cleans up resources."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.live_feed.close()
