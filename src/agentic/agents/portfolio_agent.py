from typing import Dict, Any
from src.agentic.state import AgentState
from src.agentic.tools.read_tools import AgentReadTools

# Basic sector mapping for common NSE Equities
SECTOR_MAPPING = {
    "RELIANCE": "Energy & Petrochemicals",
    "TCS": "Information Technology",
    "INFY": "Information Technology",
    "HDFCBANK": "Banking & Financial Services",
    "ICICIBANK": "Banking & Financial Services",
    "SBIN": "Banking & Financial Services",
    "TATAMOTORS": "Automotive",
    "ITC": "FMCG"
}

class PortfolioAgent:
    """
    Specialist Agent for Portfolio & Risk Intelligence:
    1. Reads active positions and ledger cash balances.
    2. Calculates sector concentration.
    3. Identifies largest daily losers and winners.
    4. Explains portfolio P&L changes and margin utilization.
    """
    def __init__(self, read_tools: AgentReadTools):
        self.read_tools = read_tools

    async def run(self, state: AgentState) -> Dict[str, Any]:
        account_id = state.get("account_id", "ACC_001")
        
        # 1. Fetch positions and ledger
        positions = await self.read_tools.get_portfolio_positions(account_id)
        ledger_summary = await self.read_tools.get_ledger_summary(account_id)
        
        # 2. Analyze Sector Concentration
        total_market_value = 0.0
        sector_values = {}
        for p in positions:
            qty = abs(p.get("quantity", 0))
            price = p.get("current_price") or p.get("average_price", 0.0)
            val = qty * price
            total_market_value += val
            
            sector = SECTOR_MAPPING.get(p.get("symbol", ""), "Diversified / Other")
            sector_values[sector] = sector_values.get(sector, 0.0) + val

        sector_concentration = {}
        if total_market_value > 0:
            for sec, val in sector_values.items():
                sector_concentration[sec] = round((val / total_market_value) * 100, 2)

        # 3. Identify Biggest Losers & Winners
        # Ranked by total unrealized P&L
        sorted_by_pnl = sorted(positions, key=lambda x: x.get("unrealized_pnl", 0.0))
        biggest_losers = [p for p in sorted_by_pnl if p.get("unrealized_pnl", 0.0) < 0]
        biggest_winners = [p for p in sorted_by_pnl if p.get("unrealized_pnl", 0.0) > 0]
        
        total_unrealized_pnl = sum(p.get("unrealized_pnl", 0.0) for p in positions)
        total_realized_pnl = sum(p.get("realized_pnl", 0.0) for p in positions)
        
        analysis = {
            "account_id": account_id,
            "total_positions": len(positions),
            "cash_balance": ledger_summary.get("cash_balance", 0.0),
            "total_unrealized_pnl": total_unrealized_pnl,
            "total_realized_pnl": total_realized_pnl,
            "sector_concentration": sector_concentration,
            "biggest_losers": biggest_losers,
            "biggest_winners": biggest_winners
        }

        specialist_data = dict(state.get("specialist_data", {}))
        specialist_data["portfolio"] = analysis

        return {
            "specialist_data": specialist_data,
            "next_worker": "synthesizer"
        }
