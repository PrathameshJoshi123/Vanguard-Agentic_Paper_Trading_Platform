from decimal import Decimal
from typing import Optional

from src.core.trade_service import TradeExecutionService
from src.market_data.gateway import MarketDataGateway
from src.events.bus import InMemoryEventBus, default_event_bus

# Singleton instance of the in-memory trading engine
_trade_service: Optional[TradeExecutionService] = None
_market_gateway: Optional[MarketDataGateway] = None


def get_event_bus() -> InMemoryEventBus:
    return default_event_bus


def get_trade_service() -> TradeExecutionService:
    global _trade_service
    if _trade_service is None:
        _trade_service = TradeExecutionService(event_bus=get_event_bus())
        # Initialize default account with 1,000,000 INR demo cash if not exists
        _trade_service.register_account("DEFAULT", initial_deposit=Decimal("1000000.00"))
    return _trade_service


def get_market_gateway() -> MarketDataGateway:
    global _market_gateway
    if _market_gateway is None:
        svc = get_trade_service()
        _market_gateway = MarketDataGateway(
            replay_mode=True,
            event_bus=get_event_bus(),
            position_manager=svc.position_manager,
        )
    return _market_gateway


def reset_engine_state() -> None:
    """Helper for testing to reset engine singletons."""
    global _trade_service, _market_gateway
    _trade_service = None
    _market_gateway = None
    default_event_bus.clear()
