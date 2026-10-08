from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Optional, Tuple
from pydantic import BaseModel, Field

from src.common.money import to_money
from src.portfolio.models import Position


class TriggerContext(BaseModel):
    """Context information when a risk threshold is breached."""
    symbol: str
    account_id: str
    trigger_type: str
    current_price: Decimal
    reference_price: Decimal
    change_pct: Decimal
    unrealized_pnl: Decimal
    quantity: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DebounceTracker:
    """
    Prevents alert storms by enforcing a configurable cooldown period (default 60s)
    and allowing immediate re-trigger if an additional incremental drop (>= 2%) occurs.
    """

    def __init__(self, cooldown_seconds: float = 60.0, retrigger_delta_pct: Decimal = Decimal("2.0")):
        self.cooldown_seconds = cooldown_seconds
        self.retrigger_delta_pct = retrigger_delta_pct
        # key -> (last_time, last_price)
        self._history: Dict[str, Tuple[datetime, Decimal]] = {}

    def should_trigger(self, key: str, current_price: Decimal, now: Optional[datetime] = None) -> bool:
        current_time = now or datetime.now(timezone.utc)
        if key not in self._history:
            self._history[key] = (current_time, current_price)
            return True

        last_time, last_price = self._history[key]
        elapsed = (current_time - last_time).total_seconds()

        # If cooldown has elapsed, trigger and reset timer
        if elapsed >= self.cooldown_seconds:
            self._history[key] = (current_time, current_price)
            return True

        # Check if an additional drop >= retrigger_delta_pct occurred
        if last_price > Decimal("0.00") and current_price < last_price:
            additional_drop_pct = ((last_price - current_price) / last_price) * Decimal("100.0")
            if additional_drop_pct >= self.retrigger_delta_pct:
                self._history[key] = (current_time, current_price)
                return True

        return False

    def reset(self) -> None:
        self._history.clear()


class RiskThresholdEvaluator:
    """
    Evaluates whether an incoming tick or position update breaches autonomous alert criteria:
      1. TICK_PRICE_DROP > 3%
      2. UNREALIZED_LOSS > 5%
    """

    def __init__(
        self,
        tick_drop_threshold_pct: Decimal = Decimal("3.0"),
        unrealized_loss_threshold_pct: Decimal = Decimal("5.0"),
    ):
        self.tick_drop_threshold_pct = tick_drop_threshold_pct
        self.unrealized_loss_threshold_pct = unrealized_loss_threshold_pct

    def evaluate_position_drawdown(self, pos: Position, ltp: Decimal) -> Optional[TriggerContext]:
        """Checks if a held position's unrealized loss exceeds the threshold (5%)."""
        if not pos.is_open or pos.average_price <= Decimal("0.00"):
            return None

        # Calculate percentage drawdown from average entry price
        if pos.is_long:
            drawdown_pct = ((pos.average_price - ltp) / pos.average_price) * Decimal("100.0")
        else:
            drawdown_pct = ((ltp - pos.average_price) / pos.average_price) * Decimal("100.0")

        if drawdown_pct >= self.unrealized_loss_threshold_pct:
            return TriggerContext(
                symbol=pos.symbol,
                account_id=pos.account_id,
                trigger_type="UNREALIZED_LOSS_THRESHOLD",
                current_price=to_money(ltp),
                reference_price=pos.average_price,
                change_pct=to_money(-drawdown_pct),
                unrealized_pnl=pos.unrealized_pnl,
                quantity=pos.quantity,
            )
        return None

    def evaluate_tick_drop(
        self,
        symbol: str,
        current_ltp: Decimal,
        reference_price: Decimal,
        account_id: str = "GLOBAL",
        quantity: int = 0,
        unrealized_pnl: Decimal = Decimal("0.00"),
    ) -> Optional[TriggerContext]:
        """Checks if a stock dropped > 3% from a reference price (open, high, or previous reference)."""
        if reference_price <= Decimal("0.00"):
            return None

        drop_pct = ((reference_price - current_ltp) / reference_price) * Decimal("100.0")
        if drop_pct >= self.tick_drop_threshold_pct:
            return TriggerContext(
                symbol=symbol,
                account_id=account_id,
                trigger_type="TICK_PRICE_DROP",
                current_price=to_money(current_ltp),
                reference_price=reference_price,
                change_pct=to_money(-drop_pct),
                unrealized_pnl=unrealized_pnl,
                quantity=quantity,
            )
        return None
