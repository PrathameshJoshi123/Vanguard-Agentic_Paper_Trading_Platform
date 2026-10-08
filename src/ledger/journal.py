from decimal import Decimal
from typing import Dict, List, Optional
import uuid

from src.common.types import LedgerCategory, AccountCategory, Side
from src.common.money import to_money
from src.ledger.charges import TradeCharges
from src.ledger.models import CustomerCashEntry, DoubleEntryLeg, DoubleEntryTransaction


class ImmutableDoubleEntryLedger:
    """
    Append-only financial ledger enforcing dual-layer accounting:
    1. Customer Cash Journal (running balance down to exact paisa).
    2. Strict Double-Entry T-Accounts with verified debits == credits.
    """

    def __init__(self):
        # Maps account_id -> list of append-only CustomerCashEntry
        self._customer_entries: Dict[str, List[CustomerCashEntry]] = {}
        # Append-only list of balanced DoubleEntryTransactions
        self._double_entry_journal: List[DoubleEntryTransaction] = []
        # Current balances: account_id -> Decimal
        self._balances: Dict[str, Decimal] = {}

    def get_running_balance(self, account_id: str) -> Decimal:
        """Returns current verified cash balance for an account."""
        return self._balances.get(account_id, Decimal("0.00"))

    def get_entries(self, account_id: str) -> List[CustomerCashEntry]:
        """Returns chronological history of customer cash ledger entries."""
        return list(self._customer_entries.get(account_id, []))

    def get_double_entry_journal(self) -> List[DoubleEntryTransaction]:
        """Returns chronological list of double-entry transactions."""
        return list(self._double_entry_journal)

    def deposit_cash(
        self,
        account_id: str,
        amount: Decimal,
        reference_id: str = "DEPOSIT",
        description: str = "Funds deposit",
    ) -> CustomerCashEntry:
        """Credits funds into customer account and balances against system clearing."""
        amount = to_money(amount)
        current_bal = self.get_running_balance(account_id)
        new_bal = to_money(current_bal + amount)
        self._balances[account_id] = new_bal

        entry = CustomerCashEntry(
            entry_id=f"CCE_{uuid.uuid4().hex[:10]}",
            account_id=account_id,
            category=LedgerCategory.CASH_DEPOSIT,
            debit=Decimal("0.00"),
            credit=amount,
            running_balance=new_bal,
            reference_id=reference_id,
            description=description,
        )
        self._customer_entries.setdefault(account_id, []).append(entry)

        # Balanced Double-Entry T-Account:
        # Debit USER_CASH (asset increase), Credit EXCHANGE_SETTLEMENT (capital funding)
        txn = DoubleEntryTransaction(
            transaction_id=f"TXN_{uuid.uuid4().hex[:10]}",
            reference_id=reference_id,
            reference_type="CASH_DEPOSIT",
            description=description,
            legs=[
                DoubleEntryLeg(
                    account_category=AccountCategory.USER_CASH,
                    account_id=account_id,
                    debit=amount,
                    credit=Decimal("0.00"),
                ),
                DoubleEntryLeg(
                    account_category=AccountCategory.EXCHANGE_SETTLEMENT,
                    account_id="SYSTEM_CLEARING",
                    debit=Decimal("0.00"),
                    credit=amount,
                ),
            ],
        )
        self._double_entry_journal.append(txn)
        return entry

    def record_trade_charges(
        self,
        account_id: str,
        trade_id: str,
        charges: TradeCharges,
    ) -> List[CustomerCashEntry]:
        """
        Debits each statutory charge and brokerage fee individually from customer cash
        and credits the respective liability / revenue accounts.
        """
        entries: List[CustomerCashEntry] = []
        charge_items = [
            (charges.brokerage, LedgerCategory.BROKERAGE_CHARGE, AccountCategory.BROKER_REVENUE, "Brokerage fee"),
            (charges.stt, LedgerCategory.STT_CHARGE, AccountCategory.STT_PAYABLE, "Securities Transaction Tax"),
            (charges.exchange_turnover_charge, LedgerCategory.EXCHANGE_TURNOVER_CHARGE, AccountCategory.EXCHANGE_FEES_PAYABLE, "Exchange turnover fee"),
            (charges.sebi_turnover_charge, LedgerCategory.SEBI_TURNOVER_CHARGE, AccountCategory.SEBI_FEES_PAYABLE, "SEBI turnover charges"),
            (charges.stamp_duty, LedgerCategory.STAMP_DUTY_CHARGE, AccountCategory.STAMP_DUTY_PAYABLE, "Stamp duty"),
            (charges.gst, LedgerCategory.GST_CHARGE, AccountCategory.GST_PAYABLE, "Goods & Services Tax (18%)"),
        ]

        double_entry_legs: List[DoubleEntryLeg] = []
        total_debit = Decimal("0.00")

        current_bal = self.get_running_balance(account_id)

        for amt, cat, acct_cat, desc in charge_items:
            if amt > Decimal("0.00"):
                current_bal = to_money(current_bal - amt)
                c_entry = CustomerCashEntry(
                    entry_id=f"CCE_{uuid.uuid4().hex[:10]}",
                    account_id=account_id,
                    category=cat,
                    debit=amt,
                    credit=Decimal("0.00"),
                    running_balance=current_bal,
                    reference_id=trade_id,
                    description=desc,
                )
                entries.append(c_entry)
                self._customer_entries.setdefault(account_id, []).append(c_entry)

                double_entry_legs.append(
                    DoubleEntryLeg(
                        account_category=acct_cat,
                        account_id="REGULATORY_CLEARING",
                        debit=Decimal("0.00"),
                        credit=amt,
                    )
                )
                total_debit = to_money(total_debit + amt)

        self._balances[account_id] = current_bal

        if total_debit > Decimal("0.00"):
            # Offsetting debit leg for user funds
            user_debit_leg = DoubleEntryLeg(
                account_category=AccountCategory.USER_CASH,
                account_id=account_id,
                debit=total_debit,
                credit=Decimal("0.00"),
            )
            txn = DoubleEntryTransaction(
                transaction_id=f"TXN_{uuid.uuid4().hex[:10]}",
                reference_id=trade_id,
                reference_type="TRADE_CHARGES",
                description=f"Statutory charges and brokerage for trade {trade_id}",
                legs=[user_debit_leg] + double_entry_legs,
            )
            self._double_entry_journal.append(txn)

        return entries

    def record_realized_pnl(
        self,
        account_id: str,
        trade_id: str,
        realized_pnl: Decimal,
    ) -> Optional[CustomerCashEntry]:
        """
        Records realized P&L settlement on closed trade portions.
        Positive P&L credits user cash, negative P&L debits user cash.
        """
        if realized_pnl == Decimal("0.00"):
            return None

        current_bal = self.get_running_balance(account_id)
        if realized_pnl > Decimal("0.00"):
            new_bal = to_money(current_bal + realized_pnl)
            entry = CustomerCashEntry(
                entry_id=f"CCE_{uuid.uuid4().hex[:10]}",
                account_id=account_id,
                category=LedgerCategory.REALIZED_PNL,
                debit=Decimal("0.00"),
                credit=realized_pnl,
                running_balance=new_bal,
                reference_id=trade_id,
                description=f"Realized intraday profit settlement for trade {trade_id}",
            )
            legs = [
                DoubleEntryLeg(
                    account_category=AccountCategory.USER_CASH,
                    account_id=account_id,
                    debit=realized_pnl,
                    credit=Decimal("0.00"),
                ),
                DoubleEntryLeg(
                    account_category=AccountCategory.EXCHANGE_SETTLEMENT,
                    account_id="MARKET_SETTLEMENT",
                    debit=Decimal("0.00"),
                    credit=realized_pnl,
                ),
            ]
        else:
            loss_amount = abs(realized_pnl)
            new_bal = to_money(current_bal - loss_amount)
            entry = CustomerCashEntry(
                entry_id=f"CCE_{uuid.uuid4().hex[:10]}",
                account_id=account_id,
                category=LedgerCategory.REALIZED_PNL,
                debit=loss_amount,
                credit=Decimal("0.00"),
                running_balance=new_bal,
                reference_id=trade_id,
                description=f"Realized intraday loss settlement for trade {trade_id}",
            )
            legs = [
                DoubleEntryLeg(
                    account_category=AccountCategory.EXCHANGE_SETTLEMENT,
                    account_id="MARKET_SETTLEMENT",
                    debit=loss_amount,
                    credit=Decimal("0.00"),
                ),
                DoubleEntryLeg(
                    account_category=AccountCategory.USER_CASH,
                    account_id=account_id,
                    debit=Decimal("0.00"),
                    credit=loss_amount,
                ),
            ]

        self._balances[account_id] = new_bal
        self._customer_entries.setdefault(account_id, []).append(entry)

        txn = DoubleEntryTransaction(
            transaction_id=f"TXN_{uuid.uuid4().hex[:10]}",
            reference_id=trade_id,
            reference_type="REALIZED_PNL",
            description=entry.description,
            legs=legs,
        )
        self._double_entry_journal.append(txn)
        return entry

    def record_cnc_settlement(
        self,
        account_id: str,
        trade_id: str,
        side: Side,
        amount: Decimal,
    ) -> CustomerCashEntry:
        """
        Direct cash settlement for CNC delivery trades (Option A - Instant settlement).
        Buy debits 100% order value, Sell credits 100% sale proceeds.
        """
        amount = to_money(amount)
        current_bal = self.get_running_balance(account_id)

        if side == Side.BUY:
            new_bal = to_money(current_bal - amount)
            entry = CustomerCashEntry(
                entry_id=f"CCE_{uuid.uuid4().hex[:10]}",
                account_id=account_id,
                category=LedgerCategory.TRADE_SETTLEMENT,
                debit=amount,
                credit=Decimal("0.00"),
                running_balance=new_bal,
                reference_id=trade_id,
                description=f"Delivery purchase pay-in for trade {trade_id}",
            )
            legs = [
                DoubleEntryLeg(
                    account_category=AccountCategory.EXCHANGE_SETTLEMENT,
                    account_id="CLEARING_HOUSE",
                    debit=amount,
                    credit=Decimal("0.00"),
                ),
                DoubleEntryLeg(
                    account_category=AccountCategory.USER_CASH,
                    account_id=account_id,
                    debit=Decimal("0.00"),
                    credit=amount,
                ),
            ]
        else:
            new_bal = to_money(current_bal + amount)
            entry = CustomerCashEntry(
                entry_id=f"CCE_{uuid.uuid4().hex[:10]}",
                account_id=account_id,
                category=LedgerCategory.TRADE_SETTLEMENT,
                debit=Decimal("0.00"),
                credit=amount,
                running_balance=new_bal,
                reference_id=trade_id,
                description=f"Delivery sale pay-out for trade {trade_id}",
            )
            legs = [
                DoubleEntryLeg(
                    account_category=AccountCategory.USER_CASH,
                    account_id=account_id,
                    debit=amount,
                    credit=Decimal("0.00"),
                ),
                DoubleEntryLeg(
                    account_category=AccountCategory.EXCHANGE_SETTLEMENT,
                    account_id="CLEARING_HOUSE",
                    debit=Decimal("0.00"),
                    credit=amount,
                ),
            ]

        self._balances[account_id] = new_bal
        self._customer_entries.setdefault(account_id, []).append(entry)

        txn = DoubleEntryTransaction(
            transaction_id=f"TXN_{uuid.uuid4().hex[:10]}",
            reference_id=trade_id,
            reference_type="CNC_SETTLEMENT",
            description=entry.description,
            legs=legs,
        )
        self._double_entry_journal.append(txn)
        return entry

    def verify_audit_integrity(self, account_id: str) -> bool:
        """
        Audits running balance by recomputing sequentially from entry history.
        Enforces that running balance matches down to the exact paisa.
        """
        entries = self.get_entries(account_id)
        computed_bal = Decimal("0.00")
        for entry in entries:
            computed_bal = to_money(computed_bal + entry.credit - entry.debit)
            if computed_bal != entry.running_balance:
                return False
        return computed_bal == self.get_running_balance(account_id)
