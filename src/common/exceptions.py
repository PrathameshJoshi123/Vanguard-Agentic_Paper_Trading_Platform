class TradingEngineException(Exception):
    """Base exception for all trading engine errors."""
    pass


class InvalidOrderStateTransitionError(TradingEngineException):
    """Raised when an illegal order status transition is attempted."""
    def __init__(self, order_id: str, current_status: str, target_status: str, reason: str = ""):
        message = f"Illegal transition for order '{order_id}': cannot move from '{current_status}' to '{target_status}'."
        if reason:
            message += f" Reason: {reason}"
        super().__init__(message)
        self.order_id = order_id
        self.current_status = current_status
        self.target_status = target_status


class InvalidOrderError(TradingEngineException):
    """Raised when an order validation fails."""
    pass


class OrderNotFoundError(TradingEngineException):
    """Raised when an order is not found in the order book or repository."""
    pass


class InsufficientMarginError(TradingEngineException):
    """Raised when an account does not have sufficient available margin for an order."""
    pass


class InsufficientHoldingsError(TradingEngineException):
    """Raised when an account attempts to sell CNC without sufficient free holdings."""
    pass


class LedgerImbalanceError(TradingEngineException):
    """Raised when debits and credits do not balance in double-entry bookkeeping."""
    pass


class PositionNotFoundError(TradingEngineException):
    """Raised when a queried position does not exist."""
    pass
