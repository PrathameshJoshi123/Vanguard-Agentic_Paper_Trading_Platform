from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Integer, Numeric, DateTime
from src.storage.database import Base


class OrderModel(Base):
    __tablename__ = "orders"

    order_id = Column(String(64), primary_key=True)
    account_id = Column(String(64), nullable=False, index=True)
    symbol = Column(String(32), nullable=False, index=True)
    side = Column(String(16), nullable=False)
    order_type = Column(String(16), nullable=False)
    product_type = Column(String(16), nullable=False)
    time_in_force = Column(String(16), default="DAY", nullable=False)
    status = Column(String(32), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(precision=16, scale=2), nullable=True)
    trigger_price = Column(Numeric(precision=16, scale=2), nullable=True)
    filled_qty = Column(Integer, default=0, nullable=False)
    remaining_qty = Column(Integer, nullable=False)
    average_fill_price = Column(Numeric(precision=16, scale=2), nullable=True)
    sequence_id = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
