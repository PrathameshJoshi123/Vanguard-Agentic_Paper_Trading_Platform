from decimal import Decimal
from pydantic import BaseModel


class AccountRiskResponse(BaseModel):
    account_id: str
    cash_balance: Decimal
    realized_pnl: Decimal
    blocked_margin: Decimal
    position_margin: Decimal
    available_margin: Decimal
    free_cash: Decimal
    margin_utilization_pct: Decimal
