import re
from typing import Dict, Any
from src.agentic.state import AgentState
from src.agentic.tools.read_tools import AgentReadTools

class ResearchAgent:
    """
    Specialist Agent for deep security research, live quotes,
    and scraping RSS news catalysts (Google News RSS / Moneycontrol RSS).
    """
    def __init__(self, read_tools: AgentReadTools):
        self.read_tools = read_tools

    async def run(self, state: AgentState) -> Dict[str, Any]:
        query = state["current_query"]
        
        # Extract potential stock symbol (e.g. RELIANCE, TCS, INFY)
        symbols = re.findall(r"\b[A-Z]{3,10}\b", query.upper())
        # Filter common words
        common_words = {"BUY", "SELL", "WHAT", "NEWS", "STOCK", "SHARE", "SHARES", "TODAY", "PORTFOLIO", "ORDER", "LIMIT", "MARKET"}
        target_symbols = [s for s in symbols if s not in common_words]
        
        if not target_symbols:
            # Fallback search if query mentions Reliance or other common Indian names
            if "RELIANCE" in query.upper():
                target_symbols = ["RELIANCE"]
            elif "TCS" in query.upper():
                target_symbols = ["TCS"]
            elif "INFY" in query.upper():
                target_symbols = ["INFY"]
            else:
                target_symbols = ["NIFTY"]

        symbol = target_symbols[0]
        
        # 1. Fetch current price
        quote = await self.read_tools.get_current_price(symbol)
        
        # 2. Scrape RSS news catalysts
        news_items = await self.read_tools.get_news_by_symbol(symbol, limit=3)

        result = {
            "symbol": symbol,
            "quote": quote,
            "catalysts": news_items,
            "summary": f"Research for {symbol}: Current LTP is ₹{quote.get('ltp', 0.0):.2f}. Found {len(news_items)} recent news catalysts."
        }

        # Update state data
        specialist_data = dict(state.get("specialist_data", {}))
        specialist_data["research"] = result

        return {
            "specialist_data": specialist_data,
            "next_worker": "synthesizer"
        }
