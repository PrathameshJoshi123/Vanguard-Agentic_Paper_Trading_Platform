import os
import logging
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_mistralai import ChatMistralAI
from src.agentic.config import agent_settings

logger = logging.getLogger(__name__)

class MockDeterministicLLM(BaseChatModel):
    """
    Deterministic Mock LLM used when MISTRAL_API_KEY is not configured
    or for deterministic offline testing.
    """
    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        last_msg = messages[-1].content if messages else ""
        if "risk" in last_msg.lower() or "alert" in last_msg.lower() or "drawdown" in last_msg.lower():
            content = "RISK ALERT: Sharp price drop detected in held position. Unrealized loss has breached safety threshold. Recommend reviewing stop-loss or reducing exposure to protect capital."
        else:
            content = "Synthesized multi-agent response: analysis completed."
        return AIMessage(content=content)

    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        return self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    @property
    def _llm_type(self) -> str:
        return "mock-mistral"

def get_mistral_llm() -> BaseChatModel:
    """
    Returns ChatMistralAI instance if MISTRAL_API_KEY is set,
    otherwise returns MockDeterministicLLM for safe testing.
    """
    api_key = agent_settings.mistral_api_key or os.getenv("MISTRAL_API_KEY", "")
    if api_key and not api_key.startswith("mock"):
        try:
            return ChatMistralAI(
                model=agent_settings.mistral_model,
                api_key=api_key,
                temperature=0.1
            )
        except Exception as e:
            logger.warning(f"Failed to initialize ChatMistralAI: {e}. Falling back to Mock LLM.")
            return MockDeterministicLLM()
    
    return MockDeterministicLLM()
