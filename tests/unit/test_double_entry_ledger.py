from decimal import Decimal
import pytest

from src.common.types import Side, ProductType, LedgerCategory
from src.ledger.charges import IndianRegulatoryChargesCalculator
from src.ledger.journal import ImmutableDoubleEntryLedger


def test_deposit_and_audit_integrity():
    ledger = ImmutableDoubleEntryLedger()
    account_id = "ACC_1"

    entry = ledger.deposit_cash(account_id, Decimal("50000.00"), reference_id="DEP_1")
    assert entry.running_balance == Decimal("50000.00")
    assert ledger.get_running_balance(account_id) == Decimal("50000.00")
    assert ledger.verify_audit_integrity(account_id) is True

    # Check that double-entry transaction was created and balanced
    txns = ledger.get_double_entry_journal()
    assert len(txns) == 1
    txn = txns[0]
    total_debits = sum(leg.debit for leg in txn.legs)
    total_credits = sum(leg.credit for leg in txn.legs)
    assert total_debits == total_credits == Decimal("50000.00")


def test_charges_breakdown_ledger_entries():
    ledger = ImmutableDoubleEntryLedger()
    account_id = "ACC_1"
    ledger.deposit_cash(account_id, Decimal("10000.00"))

    calc = IndianRegulatoryChargesCalculator()
    charges = calc.calculate_trade_charges(
        side=Side.BUY,
        product_type=ProductType.MIS,
        price=Decimal("100.00"),
        quantity=100,
    )
    # Total charges: ₹4.21
    entries = ledger.record_trade_charges(account_id, "TR_1", charges)
    assert len(entries) == 5  # Brokerage, Exchange, SEBI, Stamp, GST (STT is 0 on MIS buy)
    assert ledger.get_running_balance(account_id) == Decimal("10000.00") - Decimal("4.21")
    assert ledger.verify_audit_integrity(account_id) is True

    # Verify latest double entry transaction balance
    latest_txn = ledger.get_double_entry_journal()[-1]
    assert sum(leg.debit for leg in latest_txn.legs) == sum(leg.credit for leg in latest_txn.legs) == Decimal("4.21")


def test_realized_pnl_ledger_credit_and_debit():
    ledger = ImmutableDoubleEntryLedger()
    account_id = "ACC_1"
    ledger.deposit_cash(account_id, Decimal("10000.00"))

    # Credit profit ₹1,000.00
    profit_entry = ledger.record_realized_pnl(account_id, "TR_2", Decimal("1000.00"))
    assert profit_entry is not None
    assert profit_entry.credit == Decimal("1000.00")
    assert ledger.get_running_balance(account_id) == Decimal("11000.00")
    assert ledger.verify_audit_integrity(account_id) is True

    # Debit loss ₹250.00
    loss_entry = ledger.record_realized_pnl(account_id, "TR_3", Decimal("-250.00"))
    assert loss_entry is not None
    assert loss_entry.debit == Decimal("250.00")
    assert ledger.get_running_balance(account_id) == Decimal("10750.00")
    assert ledger.verify_audit_integrity(account_id) is True
