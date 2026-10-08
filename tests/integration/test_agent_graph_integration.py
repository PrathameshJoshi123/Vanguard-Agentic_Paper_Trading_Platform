import pytest
from decimal import Decimal
from src.agentic.graph import build_agentic_graph
from src.risk.engine import PreTradeRiskEngine
from src.risk.margin import MarginCalculator
from src.portfolio.position_manager import PositionManager
from src.portfolio.models import Position
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.common.types import ProductType

@pytest.mark.asyncio
async def test_phase_5_exit_criteria_excessive_order_rejected():
    """
    Phase 5 Exit Criteria:
    Ask: 'Buy 1,000,000 shares of Reliance.'
    Verify the agent runs the policy check and answers:
    'Cannot execute: Order exceeds maximum allowed account margin. Order rejected.'
    or rejects due to maximum allowed position size.
    """
    ledger = ImmutableDoubleEntryLedger()
    ledger.deposit_cash("ACC_001", Decimal("50000.00"))
    pos_mgr = PositionManager()
    risk_engine = PreTradeRiskEngine()

    graph = build_agentic_graph(
        risk_engine=risk_engine,
        position_manager=pos_mgr,
        ledger=ledger
    )

    state = {
        "messages": [],
        "account_id": "ACC_001",
        "current_query": "Buy 1,000,000 shares of Reliance",
        "next_worker": None,
        "specialist_data": {},
        "final_response": None
    }

    result = await graph.ainvoke(state)
    response = result.get("final_response", "")

    # Must contain rejection explanation
    assert "Cannot execute:" in response
    assert "Order rejected." in response

@pytest.mark.asyncio
async def test_agent_portfolio_loss_explanation_flow():
    """
    Test user asking 'Why did my portfolio lose money today?'
    Routes to portfolio specialist and returns sector concentration and top losers.
    """
    ledger = ImmutableDoubleEntryLedger()
    ledger.deposit_cash("ACC_001", Decimal("100000.00"))

    pos_mgr = PositionManager()
    pos_mgr._positions[("ACC_001", "TCS", ProductType.MIS)] = Position(
        account_id="ACC_001",
        symbol="TCS",
        product_type=ProductType.MIS,
        quantity=20,
        average_price=Decimal("3500.00"),
        unrealized_pnl=Decimal("-1500.00")
    )


    graph = build_agentic_graph(
        position_manager=pos_mgr,
        ledger=ledger
    )

    state = {
        "messages": [],
        "account_id": "ACC_001",
        "current_query": "Why did my portfolio lose money today?",
        "next_worker": None,
        "specialist_data": {},
        "final_response": None
    }

    result = await graph.ainvoke(state)
    response = result.get("final_response", "")

    assert "Portfolio Health & P&L Analysis" in response
    assert "TCS" in response
    assert "Top Losers:" in response or "loss" in response.lower()
