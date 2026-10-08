import asyncio
import logging
import uuid
from decimal import Decimal
from typing import Dict, Optional
from langchain_core.messages import HumanMessage
from langchain_core.language_models.chat_models import BaseChatModel

from src.agentic.llm import get_mistral_llm
from src.agentic.monitor.rules import DebounceTracker, RiskThresholdEvaluator, TriggerContext
from src.common.money import to_money
from src.events.bus import InMemoryEventBus, default_event_bus
from src.events.models import DomainEvent, DomainEventType
from src.portfolio.position_manager import PositionManager

logger = logging.getLogger(__name__)


class AutonomousEventMonitor:
    """
    Autonomous Event-Driven Monitor adhering to plan.txt Section 15, 16, & 39.
    Subscribes to internal Event Bus, watches for price drops (> 3%) or position losses (> 5%),
    triggers an asynchronous LLM risk brief via Mistral AI, and broadcasts an AGENT_ALERT
    over the event bus / WebSocket without human prompting.
    """

    def __init__(
        self,
        event_bus: InMemoryEventBus,
        position_manager: PositionManager,
        llm: Optional[BaseChatModel] = None,
        cooldown_seconds: float = 60.0,
        tick_drop_threshold_pct: Decimal = Decimal("3.0"),
        unrealized_loss_threshold_pct: Decimal = Decimal("5.0"),
    ):
        self.event_bus = event_bus
        self.position_manager = position_manager
        self.llm = llm or get_mistral_llm()
        self.debounce_tracker = DebounceTracker(cooldown_seconds=cooldown_seconds)
        self.evaluator = RiskThresholdEvaluator(
            tick_drop_threshold_pct=tick_drop_threshold_pct,
            unrealized_loss_threshold_pct=unrealized_loss_threshold_pct,
        )

        # symbol -> reference price (e.g. initial price seen or high)
        self._reference_prices: Dict[str, Decimal] = {}

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._queue: Optional[asyncio.Queue[DomainEvent]] = None

    async def start(self) -> None:
        """Starts the autonomous background monitor loop."""
        if self._running:
            return
        self._running = True
        self._queue = self.event_bus.subscribe("*")
        self._task = asyncio.create_task(self._run_loop())
        logger.info("AutonomousEventMonitor started.")

    async def stop(self) -> None:
        """Stops the autonomous background monitor."""
        self._running = False
        if self._queue:
            self.event_bus.unsubscribe("*", self._queue)
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("AutonomousEventMonitor stopped.")

    async def _run_loop(self) -> None:
        while self._running and self._queue:
            try:
                event: DomainEvent = await self._queue.get()
                await self._handle_event(event)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in AutonomousEventMonitor loop: {e}")

    async def _handle_event(self, event: DomainEvent) -> None:
        # Ignore our own alerts to prevent loops
        if event.event_type == DomainEventType.AGENT_ALERT:
            return

        if event.event_type == DomainEventType.TICK_RECEIVED:
            symbol = event.entity_id.upper()
            payload = event.payload
            ltp = Decimal(str(payload.get("ltp", 0)))
            if ltp <= Decimal("0.00"):
                return

            # Track reference price
            if symbol not in self._reference_prices:
                self._reference_prices[symbol] = ltp

            # 1. Check all open positions for this symbol
            matching_positions = [
                pos for pos in self.position_manager._positions.values()
                if pos.symbol.upper() == symbol and pos.is_open
            ]

            for pos in matching_positions:
                trigger_ctx = self.evaluator.evaluate_position_drawdown(pos, ltp)
                if trigger_ctx:
                    key = f"{pos.account_id}:{symbol}:DRAWDOWN"
                    if self.debounce_tracker.should_trigger(key, ltp):
                        await self._trigger_agent_alert(trigger_ctx)

            # 2. Check general tick drop against reference price (> 3%)
            ref_price = self._reference_prices[symbol]
            if ltp > ref_price:
                # Update high watermark reference price
                self._reference_prices[symbol] = ltp
            else:
                tick_ctx = self.evaluator.evaluate_tick_drop(
                    symbol=symbol,
                    current_ltp=ltp,
                    reference_price=ref_price,
                )
                if tick_ctx:
                    key = f"GLOBAL:{symbol}:TICK_DROP"
                    if self.debounce_tracker.should_trigger(key, ltp):
                        await self._trigger_agent_alert(tick_ctx)

    async def _trigger_agent_alert(self, ctx: TriggerContext) -> None:
        """Asynchronously synthesizes an LLM risk brief and pushes AGENT_ALERT to event bus."""
        logger.warning(
            f"Autonomous trigger fired for {ctx.symbol} ({ctx.trigger_type}): "
            f"Price {ctx.current_price}, Change {ctx.change_pct}%"
        )

        risk_brief = await self._generate_risk_brief(ctx)

        alert_payload = {
            "alert_id": f"ALT_{uuid.uuid4().hex[:8].upper()}",
            "symbol": ctx.symbol,
            "account_id": ctx.account_id,
            "severity": "CRITICAL" if abs(ctx.change_pct) >= Decimal("5.0") else "WARNING",
            "trigger_type": ctx.trigger_type,
            "current_price": float(ctx.current_price),
            "reference_price": float(ctx.reference_price),
            "change_pct": float(ctx.change_pct),
            "unrealized_pnl": float(ctx.unrealized_pnl),
            "quantity": ctx.quantity,
            "risk_brief": risk_brief,
            "actionable_suggestions": [
                "TIGHTEN_STOP_LOSS",
                "HEDGE_EXPOSURE",
                "REVIEW_POSITION_SIZE",
            ],
        }

        alert_event = DomainEvent(
            event_id=f"EVT_{uuid.uuid4().hex[:12]}",
            event_type=DomainEventType.AGENT_ALERT,
            entity_type="PORTFOLIO_RISK",
            entity_id=ctx.symbol,
            account_id=ctx.account_id if ctx.account_id != "GLOBAL" else None,
            payload=alert_payload,
        )

        self.event_bus.publish_nowait(alert_event)
        logger.info(f"Published AGENT_ALERT for {ctx.symbol} to EventBus.")

    async def _generate_risk_brief(self, ctx: TriggerContext) -> str:
        prompt = (
            f"You are an autonomous institutional risk monitoring AI. "
            f"A sharp market event has occurred for stock {ctx.symbol}:\n"
            f"- Trigger: {ctx.trigger_type}\n"
            f"- Current Price: ₹{ctx.current_price}\n"
            f"- Entry / Reference Price: ₹{ctx.reference_price}\n"
            f"- Price Change: {ctx.change_pct}%\n"
            f"- Position Quantity: {ctx.quantity}\n"
            f"- Current Unrealized P&L: ₹{ctx.unrealized_pnl}\n\n"
            f"Generate a crisp, urgent 2-sentence risk brief explaining the situation "
            f"and suggesting immediate risk management action."
        )

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            brief = response.content.strip()
            if brief:
                return brief
        except Exception as e:
            logger.error(f"Error calling LLM for risk brief: {e}")

        # Deterministic fallback brief
        return (
            f"ALERT: {ctx.symbol} experienced a sharp drop of {abs(ctx.change_pct):.2f}% to ₹{ctx.current_price}. "
            f"Unrealized P&L stands at ₹{ctx.unrealized_pnl}. Immediate risk review or trailing stop-loss advised."
        )
