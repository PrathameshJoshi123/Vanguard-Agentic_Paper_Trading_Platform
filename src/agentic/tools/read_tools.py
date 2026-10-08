from decimal import Decimal
from typing import Dict, Any, List, Optional
from src.market_data.gateway import MarketDataGateway
from src.portfolio.position_manager import PositionManager
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.agentic.tools.scraper import MarketResearchScraper

class AgentReadTools:
    """
    Firewalled Read-Only Tools for the Agentic Intelligence Plane.
    Directly inspects the deterministic domain engines without mutation.
    """
    def __init__(
        self,
        market_gateway: Optional[MarketDataGateway] = None,
        position_manager: Optional[PositionManager] = None,
        ledger: Optional[ImmutableDoubleEntryLedger] = None,
        scraper: Optional[MarketResearchScraper] = None
    ):
        self.market_gateway = market_gateway
        self.position_manager = position_manager
        self.ledger = ledger
        self.scraper = scraper or MarketResearchScraper()


    async def get_current_price(self, symbol: str) -> Dict[str, Any]:
        """Fetch current LTP, bid, ask, and spread for a symbol."""
        if self.market_gateway:
            depth = self.market_gateway.get_latest_depth(symbol)
            if depth:
                best_bid = depth.bids[0].price if depth.bids else None
                best_ask = depth.asks[0].price if depth.asks else None
                spread = (best_ask - best_bid) if (best_bid and best_ask) else None
                return {
                    "symbol": symbol.upper(),
                    "ltp": float(depth.ltp),
                    "best_bid": float(best_bid) if best_bid else None,
                    "best_ask": float(best_ask) if best_ask else None,
                    "spread": float(spread) if spread else None,
                    "timestamp": depth.timestamp.isoformat()
                }
        
        # Fallback price if not yet cached in depth
        return {
            "symbol": symbol.upper(),
            "ltp": 2500.00,
            "best_bid": 2499.50,
            "best_ask": 2500.00,
            "spread": 0.50,
            "timestamp": "Latest"
        }

    async def get_portfolio_positions(self, account_id: str) -> List[Dict[str, Any]]:
        """Fetch all active positions and calculate MTM P&L."""
        if not self.position_manager:
            return []
        
        positions = [p for p in self.position_manager._positions.values() if p.account_id == account_id]
        res = []
        for p in positions:
            res.append({
                "symbol": p.symbol,
                "product_type": p.product_type.value,
                "quantity": p.quantity,
                "average_price": float(p.average_price),
                "realized_pnl": float(p.realized_pnl),
                "unrealized_pnl": float(p.unrealized_pnl)
            })
        return res


    async def get_ledger_summary(self, account_id: str) -> Dict[str, Any]:
        """Fetch customer cash balance and realized P&L."""
        if not self.ledger:
            return {
                "account_id": account_id,
                "cash_balance": 100000.0,
                "running_balance": 100000.0
            }
        
        balance = self.ledger.get_running_balance(account_id)
        entries = self.ledger.get_entries(account_id)
        
        return {
            "account_id": account_id,
            "cash_balance": float(balance),
            "total_transactions": len(entries),
            "latest_balance": float(balance)
        }


    async def get_news_by_symbol(self, symbol: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Scrape RSS news catalysts for the given symbol."""
        return await self.scraper.fetch_news_by_symbol(symbol, limit=limit)
