import asyncio
import logging
from typing import Dict, List, Optional, Set
import uuid

from src.events.models import DomainEvent

logger = logging.getLogger(__name__)


class InMemoryEventBus:
    """
    High-performance in-memory async event bus using native asyncio.Queue.
    Provides topic-based routing and fan-out decoupling the low-latency
    matching engine from WebSocket broadcasts, database persistence, and AI agents.
    """

    def __init__(self, max_queue_size: int = 10000):
        self.max_queue_size = max_queue_size
        # topic -> set of subscriber queues
        self._subscribers: Dict[str, Set[asyncio.Queue[DomainEvent]]] = {}
        self._lock = asyncio.Lock()
        self._sequence_counter: int = 0

    def next_sequence(self) -> int:
        self._sequence_counter += 1
        return self._sequence_counter

    def subscribe(self, topic: str, queue_size: Optional[int] = None) -> asyncio.Queue[DomainEvent]:
        """
        Subscribes to a topic. Returns an asyncio.Queue that receives events matching the topic.
        Wildcard '*' receives all events.
        """
        q_size = queue_size or self.max_queue_size
        q: asyncio.Queue[DomainEvent] = asyncio.Queue(maxsize=q_size)
        if topic not in self._subscribers:
            self._subscribers[topic] = set()
        self._subscribers[topic].add(q)
        return q

    def unsubscribe(self, topic: str, q: asyncio.Queue[DomainEvent]) -> None:
        """Removes a subscriber queue from a topic."""
        if topic in self._subscribers and q in self._subscribers[topic]:
            self._subscribers[topic].discard(q)
            if not self._subscribers[topic]:
                del self._subscribers[topic]

    def publish_nowait(self, event: DomainEvent, topics: Optional[List[str]] = None) -> None:
        """
        Instantaneous non-blocking event publishing (O(1) memory queue put).
        Guarantees the core trading engine is never stalled.
        """
        if event.sequence == 0:
            event.sequence = self.next_sequence()

        target_topics: Set[str] = {"*"}
        if topics:
            target_topics.update(topics)
        if event.account_id:
            target_topics.add(f"account:{event.account_id}")
        if "symbol" in event.payload:
            target_topics.add(f"market:{event.payload['symbol']}")

        dispatched_queues: Set[asyncio.Queue[DomainEvent]] = set()

        for topic in target_topics:
            queues = self._subscribers.get(topic, set())
            for q in queues:
                if q not in dispatched_queues:
                    dispatched_queues.add(q)
                    try:
                        q.put_nowait(event)
                    except asyncio.QueueFull:
                        logger.warning(f"Subscriber queue full on topic '{topic}', dropping event '{event.event_id}'.")
                    except Exception as e:
                        logger.error(f"Error putting event to queue on topic '{topic}': {e}")

    async def publish(self, event: DomainEvent, topics: Optional[List[str]] = None) -> None:
        """Async convenience wrapper for publish_nowait."""
        self.publish_nowait(event, topics)

    def subscriber_count(self, topic: str = "*") -> int:
        return len(self._subscribers.get(topic, set()))

    def clear(self) -> None:
        """Clears all subscribers."""
        self._subscribers.clear()


# Default singleton instance
default_event_bus = InMemoryEventBus()
