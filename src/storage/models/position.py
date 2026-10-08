from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Integer, Numeric, DateTime, PrimaryKeyConstraint
from src.storage.database import Base


class PositionModel(Base):
    __tablename__ = "positions"

    account_id = Column(String(64), nullable=False)
    symbol = Column(String(32), nullable=False)
    product_type = Column(String(16), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    average_price = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    realized_pnl = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    unrealized_pnl = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    total_charges = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        PrimaryKeyConstraint("account_id", "symbol", "product_type", name="pk_positions"),
    )


class HoldingModel(Base):
    __tablename__ = "holdings"

    account_id = Column(String(64), nullable=False)
    symbol = Column(String(32), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    average_buy_price = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        PrimaryKeyConstraint("account_id", "symbol", name="pk_holdings"),
    )
