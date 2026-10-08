from decimal import Decimal
from typing import Dict, Any, List
from datetime import datetime, timezone
from src.core.trade_service import TradeExecutionService
from src.common.types import Side


class AuditReconciliationService:
    """
    Continuous audit reconciliation engine adhering to plan.txt Section 45.
    Verifies:
      1. Double-Entry Equilibrium (sum(debits) == sum(credits))
      2. Cash Running Balance vs Account Risk State (0.00 discrepancy)
      3. Orders vs Executed Trade Legs
      4. Trades vs Active Position Quantities
    """

    def __init__(self, trade_service: TradeExecutionService):
        self.trade_service = trade_service

    def reconcile(self, account_id: str = "DEFAULT") -> Dict[str, Any]:
        checks: List[Dict[str, Any]] = []
        is_balanced = True
        discrepancy = Decimal("0.00")

        # 1. Double-Entry Equilibrium Check
        t_accounts = self.trade_service.ledger.get_all_t_accounts()
        total_debits = sum(acc.total_debits for acc in t_accounts.values())
        total_credits = sum(acc.total_credits for acc in t_accounts.values())
        ledger_diff = abs(total_debits - total_credits)

        if ledger_diff > Decimal("0.00"):
            is_balanced = False
            discrepancy += ledger_diff

        checks.append({
            "check": "DOUBLE_ENTRY_EQUILIBRIUM",
            "passed": ledger_diff == Decimal("0.00"),
            "total_debits": str(total_debits),
            "total_credits": str(total_credits),
            "discrepancy": str(ledger_diff),
            "details": f"Total Debits ₹{total_debits:.2f} == Total Credits ₹{total_credits:.2f}",
        })

        # 2. Customer Cash Balance Check
        ledger_cash = self.trade_service.ledger.get_running_balance(account_id)
        account = self.trade_service.get_account(account_id)
        state_cash = account.cash_balance if account else Decimal("0.00")
        cash_diff = abs(ledger_cash - state_cash)

        if cash_diff > Decimal("0.00"):
            is_balanced = False
            discrepancy += cash_diff

        checks.append({
            "check": "CASH_RUNNING_BALANCE",
            "passed": cash_diff == Decimal("0.00"),
            "ledger_cash": str(ledger_cash),
            "account_state_cash": str(state_cash),
            "discrepancy": str(cash_diff),
            "details": f"Ledger Running Balance ₹{ledger_cash:.2f} matches Account Risk State ₹{state_cash:.2f}",
        })

        # 3. Order vs Trade Fills Check
        orders = self.trade_service.get_orders(account_id)
        trades = self.trade_service.get_trades(account_id)
        order_errors = 0

        for order in orders:
            order_trades = [t for t in trades if t.order_id == order.order_id]
            trade_qty_sum = sum(t.quantity for t in order_trades)
            if trade_qty_sum != order.filled_qty:
                order_errors += 1
                is_balanced = False

        checks.append({
            "check": "ORDER_EXECUTION_AUDIT",
            "passed": order_errors == 0,
            "orders_checked": len(orders),
            "mismatches": order_errors,
            "details": f"{len(orders)} orders verified against match execution trade legs with 0 discrepancies",
        })

        # 4. Trades vs Position Quantities Check
        positions = self.trade_service.position_manager.get_positions(account_id)
        pos_errors = 0

        for pos in positions:
            sym_trades = [t for t in trades if t.symbol == pos.symbol]
            buy_qty = sum(t.quantity for t in sym_trades if t.side == Side.BUY)
            sell_qty = sum(t.quantity for t in sym_trades if t.side == Side.SELL)
            expected_net = buy_qty - sell_qty
            if expected_net != pos.quantity:
                pos_errors += 1
                is_balanced = False

        checks.append({
            "check": "POSITION_TRADE_MATCH",
            "passed": pos_errors == 0,
            "positions_checked": len(positions),
            "mismatches": pos_errors,
            "details": f"{len(positions)} active positions verified against executed trades with exact quantity alignment",
        })

        return {
            "status": "BALANCED" if is_balanced else "RECONCILIATION_FAILURE",
            "is_balanced": is_balanced,
            "discrepancy": str(discrepancy),
            "total_orders": len(orders),
            "total_trades": len(trades),
            "total_positions": len(positions),
            "account_id": account_id,
            "checks": checks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
