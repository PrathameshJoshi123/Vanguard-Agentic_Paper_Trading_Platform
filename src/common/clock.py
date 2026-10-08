from datetime import datetime, timezone


class Clock:
    """Clock interface to provide deterministic timestamps for testing and live trading."""
    def __init__(self, fixed_time: datetime | None = None):
        self._fixed_time = fixed_time

    def now(self) -> datetime:
        if self._fixed_time is not None:
            return self._fixed_time
        return datetime.now(timezone.utc)

    def set_time(self, new_time: datetime) -> None:
        self._fixed_time = new_time

    def reset(self) -> None:
        self._fixed_time = None


# Default system clock
default_clock = Clock()
