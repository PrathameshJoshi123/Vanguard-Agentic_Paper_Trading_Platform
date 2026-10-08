import os
from pydantic_settings import BaseSettings

class AgenticSettings(BaseSettings):
    mistral_api_key: str = os.getenv("MISTRAL_API_KEY", "")
    mistral_model: str = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
    
    # Policy Hard Limits
    max_position_size: float = 50000.0   # Max ₹50,000 per order
    max_single_loss: float = 2000.0      # Max ₹2,000 risk
    
    class Config:
        env_file = ".env"
        extra = "ignore"

agent_settings = AgenticSettings()
