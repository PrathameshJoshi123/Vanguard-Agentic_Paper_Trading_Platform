import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime
from src.storage.database import Base


class EventLogModel(Base):
    """
    Immutable Event Store table for Event Sourcing and Crash Recovery.
    Every DomainEvent passing through the platform is appended here in chronological order.
    """
    __tablename__ = "event_logs"

    event_id = Column(String(64), primary_key=True)
    event_type = Column(String(64), nullable=False, index=True)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(String(64), nullable=False, index=True)
    account_id = Column(String(64), nullable=True, index=True)
    payload_json = Column(Text, nullable=False)
    sequence = Column(Integer, default=0, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def to_dict(self):
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "account_id": self.account_id,
            "payload": json.loads(self.payload_json),
            "sequence": self.sequence,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
