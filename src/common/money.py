from decimal import Decimal, ROUND_HALF_UP

PAISE_PLACES = Decimal("0.01")


def to_money(val: Decimal | float | int | str) -> Decimal:
    """Quantize to two decimal places (rupees/paise) using standard ROUND_HALF_UP."""
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(PAISE_PLACES, rounding=ROUND_HALF_UP)
