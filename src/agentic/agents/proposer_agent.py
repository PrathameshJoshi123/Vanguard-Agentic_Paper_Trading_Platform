import re
from decimal import Decimal
from typing import Dict, Any, Optional
from src.agentic.state import AgentState
from src.agentic.tools.write_tools import AgentWriteTools
from src.agentic.tools.read_tools import AgentReadTools
from src.agentic.policy.models import OrderProposal
from src.common.types import Side, OrderType, ProductType

class ProposerAgent:
    """
    Specialist Agent for formulating order proposals:
    1. Parses natural language order intents ("Buy 1,000,000 shares of Reliance").
    2. Builds structured OrderProposal.
    3. Calls the restricted Policy Engine via AgentWriteTools.
    4. Records the policy result (REJECTED or NEEDS_APPROVAL).
    """
    def __init__(self, write_tools: AgentWriteTools, read_tools: AgentReadTools):
        self.write_tools = write_tools
        self.read_tools = read_tools

    async def run(self, state: AgentState) -> Dict[str, Any]:
        query = state["current_query"]
        account_id = state.get("account_id", "ACC_001")
        
        # 1. Parse Side
        side = Side.BUY if "BUY" in query.upper() else Side.SELL
        
        # 2. Parse Quantity
        # Matches patterns like '1,000,000', '1000', '50 shares'
        qty_matches = re.findall(r"(\d[\d,]*)\s*(?:shares|units|qty)?", query, re.IGNORECASE)
        quantity = 1
        for match in qty_matches:
            clean_str = match.replace(",", "")
            if clean_str.isdigit():
                val = int(clean_str)
                if val > 0:
                    quantity = val
                    break

        # 3. Parse Symbol
        symbol = "RELIANCE"
        if "RELIANCE" in query.upper():
            symbol = "RELIANCE"
        elif "TCS" in query.upper():
            symbol = "TCS"
        elif "INFY" in query.upper():
            symbol = "INFY"
        elif "HDFCBANK" in query.upper():
            symbol = "HDFCBANK"
        else:
            words = re.findall(r"\b[A-Z]{3,10}\b", query.upper())
            candidates = [w for w in words if w not in {"BUY", "SELL", "SHARES", "UNITS", "ORDER", "MARKET", "LIMIT"}]
            if candidates:
                symbol = candidates[0]

        # 4. Parse Price or fetch LTP
        price_match = re.search(r"(?:at|@|price)\s*₹?\s*(\d+(?:\.\d+)?)", query, re.IGNORECASE)
        price: Optional[Decimal] = None
        if price_match:
            price = Decimal(price_match.group(1))
        else:
            quote = await self.read_tools.get_current_price(symbol)
            price = Decimal(str(quote.get("ltp", 2500.00)))

        # 5. Product Type (Default MIS for intraday)
        product_type = ProductType.MIS
        if "CNC" in query.upper() or "DELIVERY" in query.upper():
            product_type = ProductType.CNC

        # 6. Formulate Proposal
        proposal = OrderProposal(
            account_id=account_id,
            symbol=symbol,
            side=side,
            order_type=OrderType.LIMIT if price_match else OrderType.MARKET,
            quantity=quantity,
            price=price,
            product_type=product_type
        )

        # 7. Evaluate against Policy Engine Gateway
        policy_result = await self.write_tools.propose_order(proposal)

        specialist_data = dict(state.get("specialist_data", {}))
        specialist_data["proposer"] = {
            "proposal": proposal.model_dump(),
            "policy_result": policy_result
        }

        return {
            "specialist_data": specialist_data,
            "next_worker": "synthesizer"
        }
