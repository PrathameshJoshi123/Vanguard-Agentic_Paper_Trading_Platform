import json
from typing import Dict, Any
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from src.agentic.state import AgentState

class ResponseSynthesizer:
    """
    Synthesizer Node:
    Takes output from the specialized agents and formats a clear, professional,
    and helpful explanation for the user, integrating Mistral LLM if available.
    """
    def __init__(self, llm: BaseChatModel):
        self.llm = llm

    async def run(self, state: AgentState) -> Dict[str, Any]:
        specialist_data = state.get("specialist_data", {})
        query = state["current_query"]

        # Case 1: Proposer Specialist (Policy Gateway result)
        if "proposer" in specialist_data:
            proposer_res = specialist_data["proposer"]
            policy_res = proposer_res.get("policy_result", {})
            status = policy_res.get("status")
            if status == "REJECTED":
                reason = policy_res.get("reason", "Order rejected by policy firewall.")
                final_resp = reason
            else:
                order_payload = policy_res.get("order_payload", {})
                final_resp = (
                    f"Order Proposal Prepared:\n"
                    f"Status: NEEDS_APPROVAL\n"
                    f"Symbol: {order_payload.get('symbol')} | Side: {order_payload.get('side')} | Qty: {order_payload.get('quantity')}\n"
                    f"Estimated Value: ₹{order_payload.get('estimated_order_value', 0):,.2f}\n"
                    f"Payload: {json.dumps(order_payload, indent=2)}\n"
                    f"Please confirm to execute."
                )

        # Case 2: Portfolio Specialist (Loss explanation, Concentration, Losers)
        elif "portfolio" in specialist_data:
            p_data = specialist_data["portfolio"]
            total_unrealized = p_data.get("total_unrealized_pnl", 0.0)
            total_realized = p_data.get("total_realized_pnl", 0.0)
            concentration = p_data.get("sector_concentration", {})
            losers = p_data.get("biggest_losers", [])
            
            losers_text = ""
            if losers:
                losers_summary = [f"{l['symbol']} (Loss: ₹{abs(l['unrealized_pnl']):,.2f})" for l in losers]
                losers_text = f"Top Losers: {', '.join(losers_summary)}."
            else:
                losers_text = "No losing positions currently recorded."

            conc_text = ", ".join([f"{k}: {v}%" for k, v in concentration.items()]) if concentration else "Diversified"

            final_resp = (
                f"Portfolio Health & P&L Analysis:\n"
                f"Today's Unrealized MTM P&L: ₹{total_unrealized:,.2f} | Realized P&L: ₹{total_realized:,.2f}\n"
                f"Sector Concentration: {conc_text}\n"
                f"{losers_text}\n"
                f"Overall, current drawdown is driven by these individual position moves."
            )

        # Case 3: Research Specialist (News & Catalysts)
        elif "research" in specialist_data:
            r_data = specialist_data["research"]
            symbol = r_data.get("symbol", "N/A")
            quote = r_data.get("quote", {})
            catalysts = r_data.get("catalysts", [])
            
            news_lines = []
            for item in catalysts:
                news_lines.append(f"- {item.get('title')} ({item.get('source', 'News')})")
            
            catalyst_text = "\n".join(news_lines) if news_lines else "No major news catalysts reported."
            
            final_resp = (
                f"Research Intelligence Report for {symbol}:\n"
                f"Current Market Price: ₹{quote.get('ltp', 0.0):,.2f} (Spread: ₹{quote.get('spread', 0.0)})\n"
                f"Key Catalysts & News:\n{catalyst_text}"
            )

        else:
            final_resp = "I have completed the market analysis for your request."

        # If live Mistral LLM is loaded, invoke it to polish the synthesized explanation
        if not getattr(self.llm, "_llm_type", "").startswith("mock"):
            try:
                system_prompt = (
                    "You are an AI financial trading intelligence agent. "
                    "Analyze the provided structured domain data and answer the user's question clearly, "
                    "accurately, and professionally. Adhere strictly to the safety guardrails.\n"
                    "RULES:\n"
                    "1. If the draft answer states an order was rejected, ALWAYS include the exact notice from Draft Answer (e.g. 'Cannot execute: ...').\n"
                    "2. If analyzing portfolio performance, ALWAYS preserve the header 'Portfolio Health & P&L Analysis:' and include 'Top Losers:' for loss-making holdings.\n"
                )
                user_content = f"User Query: {query}\n\nDomain Analysis Data:\n{json.dumps(specialist_data, default=str)}\n\nDraft Answer:\n{final_resp}"
                ai_msg = await self.llm.ainvoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_content)
                ])
                if ai_msg and ai_msg.content:
                    final_resp = ai_msg.content
            except Exception as e:
                # Retain deterministic structured fallback if LLM network call fails
                pass

        return {
            "final_response": final_resp,
            "next_worker": "end"
        }

