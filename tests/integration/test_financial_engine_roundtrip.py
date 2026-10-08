from decimal import Decimal
import pytest

from src.common.types import Side, OrderType, ProductType, OrderStatus
from src.core.models import Order
from src.core.trade_service import TradeExecutionService


def test_phase_2_exit_criteria_round_trip_mis_trade():
    """
    Phase 2 Exit Criteria Verification:
    - Initial account funding: ₹50,000.00
    - Round-trip trade: Buy 100 @ ₹100, Sell 100 @ ₹110 on MIS.
    - Verify:
      1. Gross Realized Profit is ₹1,000.00
      2. Charges are calculated and subtracted accurately down to exact paisa:
         - Buy Charges: ₹4.21 (Brokerage: ₹3.00, Exch: ₹0.30, SEBI: ₹0.01, Stamp: ₹0.30, GST: ₹0.60)
         - Sell Charges: ₹7.05 (Brokerage: ₹3.30, STT: ₹2.75, Exch: ₹0.33, SEBI: ₹0.01, GST: ₹0.66)
         - Total Round-Trip Charges: ₹11.26
      3. Net Profit: ₹1,000.00 - ₹11.26 = ₹988.74
      4. Ledger running balance matches down to the exact paisa: ₹50,988.74
      5. Ledger audit integrity is intact across all append-only entries and balanced double-entry T-accounts.
      6. Position is flat (qty=0) and all margins are released.
    """
    service = TradeExecutionService()
    account_id = "TRADER_01"
    account = service.register_account(account_id, initial_deposit=Decimal("50000.00"))

    assert account.cash_balance == Decimal("50000.00")
    assert service.ledger.get_running_balance(account_id) == Decimal("50000.00")

    # Seed resting counterparty seller in order book:
    # Counterparty Seller offering 100 shares @ ₹100.00
    service.matching_engine.place_order(
        Order(
            order_id="CP_ASK_100",
            symbol="TATAMOTORS",
            side=Side.SELL,
            order_type=OrderType.LIMIT,
            price=Decimal("100.00"),
            quantity=100,
            product_type=ProductType.MIS,
            account_id="COUNTERPARTY_1",
        )
    )

    # -------------------------------------------------------------
    # LEG 1: Buy 100 @ ₹100 on MIS
    # -------------------------------------------------------------
    buy_order = Order(
        order_id="BUY_MIS_01",
        symbol="TATAMOTORS",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("100.00"),
        quantity=100,
        product_type=ProductType.MIS,
        account_id=account_id,
    )

    buy_result = service.place_order(buy_order)

    # Verify execution of Leg 1
    assert buy_result.order.status == OrderStatus.FILLED
    assert buy_result.order.filled_qty == 100
    assert len(buy_result.trade_charges) == 1

    buy_charges = buy_result.trade_charges[0]
    assert buy_charges.turnover == Decimal("10000.00")
    assert buy_charges.brokerage == Decimal("3.00")
    assert buy_charges.stt == Decimal("0.00")
    assert buy_charges.exchange_turnover_charge == Decimal("0.30")
    assert buy_charges.sebi_turnover_charge == Decimal("0.01")
    assert buy_charges.stamp_duty == Decimal("0.30")
    assert buy_charges.gst == Decimal("0.60")
    assert buy_charges.total_charges == Decimal("4.21")

    # Verify position after Leg 1
    position_after_buy = service.position_manager.get_position(account_id, "TATAMOTORS", ProductType.MIS)
    assert position_after_buy.quantity == 100
    assert position_after_buy.average_price == Decimal("100.00")
    assert position_after_buy.realized_pnl == Decimal("0.00")

    # Verify cash balance after Leg 1: ₹50,000 - ₹4.21 = ₹49,995.79
    assert service.ledger.get_running_balance(account_id) == Decimal("49995.79")
    assert account.cash_balance == Decimal("49995.79")
    assert service.ledger.verify_audit_integrity(account_id) is True

    # -------------------------------------------------------------
    # LEG 2: Sell 100 @ ₹110 on MIS
    # -------------------------------------------------------------
    # Counterparty Buyer bidding 100 shares @ ₹110.00
    service.matching_engine.place_order(
        Order(
            order_id="CP_BID_110",
            symbol="TATAMOTORS",
            side=Side.BUY,
            order_type=OrderType.LIMIT,
            price=Decimal("110.00"),
            quantity=100,
            product_type=ProductType.MIS,
            account_id="COUNTERPARTY_2",
        )
    )

    sell_order = Order(
        order_id="SELL_MIS_02",
        symbol="TATAMOTORS",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        price=Decimal("110.00"),
        quantity=100,
        product_type=ProductType.MIS,
        account_id=account_id,
    )

    sell_result = service.place_order(sell_order)

    # Verify execution of Leg 2
    assert sell_result.order.status == OrderStatus.FILLED
    assert sell_result.order.filled_qty == 100
    assert len(sell_result.trade_charges) == 1

    sell_charges = sell_result.trade_charges[0]
    assert sell_charges.turnover == Decimal("11000.00")
    assert sell_charges.brokerage == Decimal("3.30")
    assert sell_charges.stt == Decimal("2.75")
    assert sell_charges.exchange_turnover_charge == Decimal("0.33")
    assert sell_charges.sebi_turnover_charge == Decimal("0.01")
    assert sell_charges.stamp_duty == Decimal("0.00")
    assert sell_charges.gst == Decimal("0.66")
    assert sell_charges.total_charges == Decimal("7.05")

    # -------------------------------------------------------------
    # FINANCIAL AUDIT & EXIT CRITERIA RECONCILIATION
    # -------------------------------------------------------------
    position_final = service.position_manager.get_position(account_id, "TATAMOTORS", ProductType.MIS)

    # 1. Position is fully closed
    assert position_final.quantity == 0
    assert position_final.is_open is False

    # 2. Gross profit is ₹1,000.00
    assert position_final.realized_pnl == Decimal("1000.00")

    # 3. Total round trip charges: ₹4.21 + ₹7.05 = ₹11.26
    total_charges = buy_charges.total_charges + sell_charges.total_charges
    assert total_charges == Decimal("11.26")
    assert position_final.total_charges == Decimal("11.26")

    # 4. Net Profit: ₹1,000.00 - ₹11.26 = ₹988.74
    assert position_final.net_pnl == Decimal("988.74")

    # 5. Ledger Running Balance matches down to exact paisa:
    # Starting ₹50,000.00 + Net Profit ₹988.74 = ₹50,988.74
    expected_final_balance = Decimal("50000.00") + Decimal("988.74")
    assert expected_final_balance == Decimal("50988.74")
    assert service.ledger.get_running_balance(account_id) == Decimal("50988.74")
    assert account.cash_balance == Decimal("50988.74")

    # 6. Ledger Audit Integrity: recomputed line-by-line matches running balance
    assert service.ledger.verify_audit_integrity(account_id) is True

    # 7. Double-entry T-Accounts: all debit and credit legs strictly balanced
    for txn in service.ledger.get_double_entry_journal():
        sum_debits = sum(leg.debit for leg in txn.legs)
        sum_credits = sum(leg.credit for leg in txn.legs)
        assert sum_debits == sum_credits

    # 8. All margins released: no blocked or position margin remains
    assert account.blocked_margin == Decimal("0.00")
    assert account.position_margin == Decimal("0.00")
    assert account.available_margin == Decimal("50988.74")
