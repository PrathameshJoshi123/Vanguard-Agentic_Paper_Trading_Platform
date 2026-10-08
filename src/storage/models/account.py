from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, DateTime
from src.storage.database import Base


class AccountModel(Base):
    __tablename__ = "accounts"

    account_id = Column(String(64), primary_key=True)
    cash_balance = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    realized_pnl = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    blocked_margin = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
