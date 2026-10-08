from collections import deque
from datetime import datetime
from typing import Dict, Optional, Set, Tuple

from src.market_data.models import FeedHealth, FeedStatus, MarketDepth


class SequenceManager:
    """
    Guarantees market data feed integrity and resilience:
      1. Duplicate Tick Detection: Drops ticks with duplicate (symbol, sequence_id, timestamp).
      2. Out-of-Order Handling: Drops ticks whose sequence or timestamp is stale.
      3. Sequence Gap Detection: Tracks skipped sequence numbers and logs health metrics.
      4. Tracks running FeedHealth statistics per instrument.
    """

    def __init__(self, history_window: int = 1000):
        self.history_window = history_window
        # symbol -> Set of (sequence_id, timestamp_str)
        self._seen_signatures: Dict[str, Set[Tuple[int, str]]] = {}
        self._signature_queue: Dict[str, deque] = {}
        # symbol -> last accepted sequence_id
        self._last_sequence: Dict[str, int] = {}
        # symbol -> last accepted timestamp
        self._last_timestamp: Dict[str, datetime] = {}
        # symbol -> FeedHealth
        self._health: Dict[str, FeedHealth] = {}

    def get_health(self, symbol: str) -> FeedHealth:
        sym = symbol.upper()
        if sym not in self._health:
            self._health[sym] = FeedHealth(symbol=sym)
        return self._health[sym]

    def validate_and_record(self, depth: MarketDepth) -> Tuple[bool, Optional[str]]:
        """
        Validates an incoming MarketDepth tick against duplicate, out-of-order, or sequence gap rules.
        Returns:
            (is_valid: bool, reason: Optional[str])
        """
        sym = depth.symbol.upper()
        health = self.get_health(sym)
        health.status = FeedStatus.CONNECTED

        ts_key = depth.timestamp.isoformat()
        signature = (depth.sequence_id, ts_key)

        # 1. Duplicate detection
        if sym not in self._seen_signatures:
            self._seen_signatures[sym] = set()
            self._signature_queue[sym] = deque()

        if signature in self._seen_signatures[sym]:
            health.duplicate_ticks_dropped += 1
            return False, f"Duplicate tick detected for {sym}: seq={depth.sequence_id}, time={ts_key}"

        # 2. Out-of-order detection
        last_seq = self._last_sequence.get(sym)
        last_ts = self._last_timestamp.get(sym)

        # Sequence-based out-of-order check (if sequence IDs are explicitly provided > 0)
        if last_seq is not None and depth.sequence_id > 0 and depth.sequence_id < last_seq:
            health.out_of_order_ticks_dropped += 1
            return False, f"Out-of-order tick (seq {depth.sequence_id} < last {last_seq}) for {sym}"

        # Timestamp-based out-of-order check
        if last_ts is not None and depth.timestamp < last_ts:
            health.out_of_order_ticks_dropped += 1
            return False, f"Out-of-order tick by timestamp ({depth.timestamp} < last {last_ts}) for {sym}"

        # 3. Gap detection (when sequence is monotonically incrementing and skips > 1)
        if last_seq is not None and depth.sequence_id > 0 and depth.sequence_id > last_seq + 1:
            gaps = depth.sequence_id - (last_seq + 1)
            health.sequence_gaps_detected += gaps

        # Update rolling signature window
        self._seen_signatures[sym].add(signature)
        self._signature_queue[sym].append(signature)
        if len(self._signature_queue[sym]) > self.history_window:
            old_sig = self._signature_queue[sym].popleft()
            self._seen_signatures[sym].discard(old_sig)

        # Commit latest accepted watermarks
        if depth.sequence_id > 0:
            self._last_sequence[sym] = depth.sequence_id
        elif last_seq is None:
            self._last_sequence[sym] = 1
        else:
            self._last_sequence[sym] = last_seq + 1

        self._last_timestamp[sym] = depth.timestamp
        health.total_ticks_processed += 1
        health.last_tick_time = depth.timestamp
        health.last_sequence_id = self._last_sequence[sym]

        return True, None
