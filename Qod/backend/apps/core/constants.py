"""Shared enums and small helpers for the bakery domain."""

from decimal import Decimal, ROUND_HALF_UP

LOCATION_HOME_BAKERY = "home_bakery"
LOCATION_CAFE = "cafe"

LOCATION_CHOICES = [
    (LOCATION_HOME_BAKERY, "Home Bakery"),
    (LOCATION_CAFE, "Café"),
]
LOCATION_LABELS = dict(LOCATION_CHOICES)

PAYMENT_METHOD_CHOICES = [
    ("cash", "Cash"),
    ("transfer", "Bank transfer"),
    ("card", "Card"),
    ("pos", "POS terminal"),
]

QTY_QUANT = Decimal("0.001")


def round_qty(value) -> Decimal:
    return Decimal(str(value)).quantize(QTY_QUANT, rounding=ROUND_HALF_UP)


def to_cents(amount) -> int:
    return int(Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def location_label(value: str) -> str:
    return LOCATION_LABELS.get(value, value)
