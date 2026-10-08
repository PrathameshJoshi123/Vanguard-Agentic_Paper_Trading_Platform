from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime
from src.storage.database import Base


class TradeModel(Base):
    __tablename__ = "trades"

    trade_id = Column(String(64), primary_key=True)
    order_id = Column(String(64), nullable=False, index=True)
    symbol = Column(String(32), nullable=False, index=True)
    side = Column(String(16), nullable=False)
    price = Column(Numeric(precision=16, scale=2), nullable=False)
    quantity = Column(Integer, nullable=False)
    counterparty_order_id = Column(String(64), nullable=False)
    is_maker = Column(Boolean, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
