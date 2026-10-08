import asyncio
import logging
from typing import Optional

from src.events.bus import InMemoryEventBus
from src.events.models import DomainEvent, DomainEventType
from src.api.websocket.manager import WebSocketConnectionManager, ws_manager

logger = logging.getLogger(__name__)


class WebSocketBroadcasterWorker:
    """
    Background worker consuming domain events from the in-memory Event Bus
    and forwarding them in real-time to active WebSocket clients.
    """

    def __init__(
        self,
        event_bus: InMemoryEventBus,
        manager: Optional[WebSocketConnectionManager] = None,
    ):
        self.event_bus = event_bus
        self.manager = manager or ws_manager
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._queue: Optional[asyncio.Queue[DomainEvent]] = None

    async def start(self) -> None:
        """Starts the broadcaster worker."""
        if self._running:
            return
        self._running = True
        self._queue = self.event_bus.subscribe("*")
        self._task = asyncio.create_task(self._run_loop())
        logger.info("WebSocketBroadcasterWorker started.")

    async def stop(self) -> None:
        """Stops the broadcaster worker."""
        self._running = False
        if self._queue:
            self.event_bus.unsubscribe("*", self._queue)
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("WebSocketBroadcasterWorker stopped.")

    async def _run_loop(self) -> None:
        while self._running and self._queue:
            try:
                event: DomainEvent = await self._queue.get()
                await self._dispatch_event(event)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in WebSocketBroadcasterWorker loop: {e}")

    async def _dispatch_event(self, event: DomainEvent) -> None:
        message = {
            "type": event.event_type,
            "timestamp": event.timestamp.isoformat(),
            "sequence": event.sequence,
            "account_id": event.account_id,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "data": event.payload,
        }

        if event.event_type == DomainEventType.TICK_RECEIVED:
            symbol = event.entity_id
            await self.manager.broadcast_tick(symbol, message)
        elif event.account_id:
            await self.manager.broadcast_to_account(event.account_id, message)
        else:
            await self.manager.broadcast_all(message)
