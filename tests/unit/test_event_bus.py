import asyncio
import pytest
from src.events.bus import InMemoryEventBus
from src.events.models import DomainEvent, DomainEventType


@pytest.mark.asyncio
async def test_event_bus_topic_routing_and_isolation():
    bus = InMemoryEventBus()

    # Subscriber 1: listens to account ACC_1
    q_acc1 = bus.subscribe("account:ACC_1")
    # Subscriber 2: listens to account ACC_2
    q_acc2 = bus.subscribe("account:ACC_2")
    # Subscriber 3: listens to market RELIANCE
    q_rel = bus.subscribe("market:RELIANCE")
    # Subscriber 4: wildcard *
    q_all = bus.subscribe("*")

    # Event 1: for ACC_1 on RELIANCE
    ev1 = DomainEvent(
        event_id="EVT_1",
        event_type=DomainEventType.ORDER_PLACED,
        entity_type="ORDER",
        entity_id="ORD_1",
        account_id="ACC_1",
        payload={"symbol": "RELIANCE", "price": "2500.00"},
    )
    bus.publish_nowait(ev1)

    # Event 2: for ACC_2 on TCS
    ev2 = DomainEvent(
        event_id="EVT_2",
        event_type=DomainEventType.ORDER_PLACED,
        entity_type="ORDER",
        entity_id="ORD_2",
        account_id="ACC_2",
        payload={"symbol": "TCS", "price": "3500.00"},
    )
    bus.publish_nowait(ev2)

    # Verify q_acc1 received only ev1
    assert q_acc1.qsize() == 1
    got1 = await q_acc1.get()
    assert got1.event_id == "EVT_1"

    # Verify q_acc2 received only ev2
    assert q_acc2.qsize() == 1
    got2 = await q_acc2.get()
    assert got2.event_id == "EVT_2"

    # Verify q_rel received only ev1
    assert q_rel.qsize() == 1
    got_rel = await q_rel.get()
    assert got_rel.event_id == "EVT_1"

    # Verify q_all received both
    assert q_all.qsize() == 2


@pytest.mark.asyncio
async def test_event_bus_unsubscribe():
    bus = InMemoryEventBus()
    q = bus.subscribe("test_topic")

    ev = DomainEvent(
        event_id="EVT_U1",
        event_type="TEST",
        entity_type="TEST",
        entity_id="1",
        payload={},
    )
    bus.publish_nowait(ev, topics=["test_topic"])
    assert q.qsize() == 1

    bus.unsubscribe("test_topic", q)
    ev2 = DomainEvent(
        event_id="EVT_U2",
        event_type="TEST",
        entity_type="TEST",
        entity_id="2",
        payload={},
    )
    bus.publish_nowait(ev2, topics=["test_topic"])
    # Queue should still only have 1 event
    assert q.qsize() == 1
