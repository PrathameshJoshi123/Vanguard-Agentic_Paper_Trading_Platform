import pytest
from decimal import Decimal
from src.agentic.tools.read_tools import AgentReadTools
from src.portfolio.position_manager import PositionManager
from src.portfolio.models import Position
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.common.types import ProductType

@pytest.mark.asyncio
async def test_agent_read_tools():
    ledger = ImmutableDoubleEntryLedger()
    ledger.deposit_cash("ACC_001", Decimal("50000.00"))


    pos_mgr = PositionManager()
    pos_mgr._positions[("ACC_001", "INFY", ProductType.MIS)] = Position(
        account_id="ACC_001",
        symbol="INFY",
        product_type=ProductType.MIS,
        quantity=50,
        average_price=Decimal("1500.00"),
        unrealized_pnl=Decimal("-1200.00")
    )


    read_tools = AgentReadTools(position_manager=pos_mgr, ledger=ledger)

    # Test get_current_price
    price_info = await read_tools.get_current_price("RELIANCE")
    assert price_info["symbol"] == "RELIANCE"
    assert price_info["ltp"] > 0

    # Test get_ledger_summary
    ledger_summary = await read_tools.get_ledger_summary("ACC_001")
    assert ledger_summary["cash_balance"] == 50000.0

    # Test get_portfolio_positions
    positions = await read_tools.get_portfolio_positions("ACC_001")
    assert len(positions) == 1
    assert positions[0]["symbol"] == "INFY"
    assert positions[0]["unrealized_pnl"] == -1200.0
