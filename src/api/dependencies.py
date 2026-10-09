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
        from src.market_data.depth_matcher import MarketDepthMatcher
        depth_matcher = MarketDepthMatcher(svc)
        svc.depth_matcher = depth_matcher
        _market_gateway = MarketDataGateway(
            replay_mode=True,
            replay_file_path="data/reliance_50_ticks.jsonl",
            replay_speed_multiplier=1.5,
            depth_matcher=depth_matcher,
            event_bus=get_event_bus(),
            position_manager=svc.position_manager,
        )
    return _market_gateway


def get_risk_engine():
    return get_trade_service().risk_engine


def get_position_manager():
    return get_trade_service().position_manager


def get_ledger():
    return get_trade_service().ledger


def get_recovery_service():
    from src.core.recovery import CrashRecoveryService
    return CrashRecoveryService(get_trade_service())


def get_reconciliation_service():
    from src.core.reconciliation import AuditReconciliationService
    return AuditReconciliationService(get_trade_service())



def reset_engine_state() -> None:
    """Helper for testing to reset engine singletons."""
    global _trade_service, _market_gateway
    _trade_service = None
    _market_gateway = None
    default_event_bus.clear()
