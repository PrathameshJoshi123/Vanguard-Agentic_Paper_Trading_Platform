import asyncio
import json
import os
from datetime import datetime
from typing import AsyncGenerator, Optional

from src.market_data.models import FeedStatus, MarketDepth
from src.market_data.normalizer import MarketDepthNormalizer


class ReplayEngine:
    """
    Asynchronous historical tick replayer.
    Streams tick-by-tick MarketDepth updates from a .jsonl file, supporting:
      - Zero-delay fast-forward (ideal for instant unit tests & backtests).
      - Configurable wall-clock pacing (speed_multiplier > 0) to mirror realistic feed intervals.
    """

    def __init__(self, file_path: str, speed_multiplier: Optional[float] = None):
        """
        Args:
            file_path: Absolute or relative path to the .jsonl tick file.
            speed_multiplier: None or 0 for instant playback; > 0 to scale historical delays
                              (e.g., 1.0 for real-time, 2.0 for 2x speed).
        """
        self.file_path = file_path
        self.speed_multiplier = speed_multiplier
        self.status = FeedStatus.DISCONNECTED
        self.ticks_replayed = 0

    async def stream_ticks(self) -> AsyncGenerator[MarketDepth, None]:
        """Streams normalized MarketDepth updates from the .jsonl file."""
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Replay tick file not found: {self.file_path}")

        self.status = FeedStatus.REPLAYING
        self.ticks_replayed = 0
        last_tick_time: Optional[datetime] = None

        with open(self.file_path, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                clean_line = line.strip()
                if not clean_line:
                    continue

                raw_data = json.loads(clean_line)
                depth = MarketDepthNormalizer.normalize_generic(raw_data, sequence_id=line_no)

                # Time pacing emulation if requested
                if self.speed_multiplier and self.speed_multiplier > 0 and last_tick_time is not None:
                    delta_seconds = (depth.timestamp - last_tick_time).total_seconds()
                    if delta_seconds > 0:
                        sleep_duration = delta_seconds / self.speed_multiplier
                        # Cap max sleep to avoid excessively long stalls
                        sleep_duration = min(sleep_duration, 5.0)
                        await asyncio.sleep(sleep_duration)

                last_tick_time = depth.timestamp
                self.ticks_replayed += 1
                yield depth

        self.status = FeedStatus.COMPLETED
