from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .models import Ingredient


UNIT_DIMENSIONS = {
    Ingredient.Unit.KILOGRAM: ("mass", Decimal("1000")),
    Ingredient.Unit.GRAM: ("mass", Decimal("1")),
    Ingredient.Unit.LITRE: ("volume", Decimal("1000")),
    Ingredient.Unit.MILLILITRE: ("volume", Decimal("1")),
    Ingredient.Unit.PIECE: ("count", Decimal("1")),
}


def convert_quantity(quantity, from_unit, to_unit):
    try:
        from_dimension, from_factor = UNIT_DIMENSIONS[from_unit]
        to_dimension, to_factor = UNIT_DIMENSIONS[to_unit]
    except KeyError:
        raise ValidationError({"unit": "Choose a supported ingredient measurement unit."}) from None
    if from_dimension != to_dimension:
        raise ValidationError({"unit": f"{from_unit} cannot be converted to {to_unit}."})
    converted = Decimal(quantity) * from_factor / to_factor
    rounded = converted.quantize(Decimal("0.001"))
    if converted != rounded:
        raise ValidationError({"quantity": f"The converted amount is too precise for {to_unit} stock."})
    return rounded


def unit_cost_in_stock_unit(total_cost, stock_quantity):
    if stock_quantity <= 0:
        raise ValidationError({"quantity": "Converted stock quantity must be greater than zero."})
    return (Decimal(total_cost) / Decimal(stock_quantity)).quantize(Decimal("0.0001"))
