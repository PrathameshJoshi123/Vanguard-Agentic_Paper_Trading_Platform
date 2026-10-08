from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

from src.common.types import LedgerCategory, AccountCategory
from src.common.money import to_money
from src.common.exceptions import LedgerImbalanceError


class CustomerCashEntry(BaseModel):
    """Append-only customer cash ledger entry with running balance."""
    entry_id: str
    account_id: str
    category: LedgerCategory
    debit: Decimal = Field(default=Decimal("0.00"))   # Reduces user cash
    credit: Decimal = Field(default=Decimal("0.00"))  # Increases user cash
    running_balance: Decimal
    reference_id: str                                 # trade_id, order_id, transfer_id
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_entry(self) -> "CustomerCashEntry":
        self.debit = to_money(self.debit)
        self.credit = to_money(self.credit)
        self.running_balance = to_money(self.running_balance)
        return self


class DoubleEntryLeg(BaseModel):
    """Individual debit or credit leg in double-entry bookkeeping."""
    account_category: AccountCategory
    account_id: str                                   # Specific user account or system clearing account
    debit: Decimal = Field(default=Decimal("0.00"))
    credit: Decimal = Field(default=Decimal("0.00"))

    @model_validator(mode="after")
    def validate_leg(self) -> "DoubleEntryLeg":
        self.debit = to_money(self.debit)
        self.credit = to_money(self.credit)
        return self


class DoubleEntryTransaction(BaseModel):
    """Enforces mathematical balance across double-entry T-accounts."""
    transaction_id: str
    reference_id: str
    reference_type: str
    description: str
    legs: List[DoubleEntryLeg] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def enforce_balance(self) -> "DoubleEntryTransaction":
        total_debits = sum((leg.debit for leg in self.legs), Decimal("0.00"))
        total_credits = sum((leg.credit for leg in self.legs), Decimal("0.00"))

        if to_money(total_debits) != to_money(total_credits):
            raise LedgerImbalanceError(
                f"Double-entry transaction '{self.transaction_id}' is imbalanced! "
                f"Total Debits: ₹{total_debits}, Total Credits: ₹{total_credits}."
            )
        return self
