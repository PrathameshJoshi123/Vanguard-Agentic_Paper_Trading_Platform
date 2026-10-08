from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from src.storage.database import Base


class CustomerCashEntryModel(Base):
    __tablename__ = "customer_cash_entries"

    entry_id = Column(String(64), primary_key=True)
    account_id = Column(String(64), nullable=False, index=True)
    category = Column(String(32), nullable=False)
    debit = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    credit = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    running_balance = Column(Numeric(precision=16, scale=2), nullable=False)
    reference_id = Column(String(64), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class DoubleEntryTransactionModel(Base):
    __tablename__ = "double_entry_transactions"

    transaction_id = Column(String(64), primary_key=True)
    reference_id = Column(String(64), nullable=False, index=True)
    reference_type = Column(String(32), nullable=False)
    description = Column(String(255), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    legs = relationship("DoubleEntryLegModel", back_populates="transaction", cascade="all, delete-orphan")


class DoubleEntryLegModel(Base):
    __tablename__ = "double_entry_legs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(64), ForeignKey("double_entry_transactions.transaction_id"), nullable=False, index=True)
    account_category = Column(String(32), nullable=False)
    account_id = Column(String(64), nullable=False)
    debit = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)
    credit = Column(Numeric(precision=16, scale=2), default=Decimal("0.00"), nullable=False)

    transaction = relationship("DoubleEntryTransactionModel", back_populates="legs")
