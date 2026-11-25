import logging

from celery import shared_task
from django.db.models import F

from .models import IngredientBalance

logger = logging.getLogger(__name__)


@shared_task(name="seasonops.tasks.report_low_stock")
def report_low_stock():
    low_balances = (
        IngredientBalance.objects.filter(
            ingredient__is_active=True,
            ingredient__reorder_level__gt=0,
            quantity__lte=F("ingredient__reorder_level"),
        )
        .select_related("location", "ingredient")
        .order_by("location__name", "ingredient__name")
    )
    count = 0
    for balance in low_balances.iterator():
        count += 1
        logger.warning(
            "Ingredient stock is at or below its reorder level.",
            extra={
                "location_id": balance.location_id,
                "location": balance.location.name,
                "ingredient_id": balance.ingredient_id,
                "ingredient": balance.ingredient.name,
                "quantity": str(balance.quantity),
                "reorder_level": str(balance.ingredient.reorder_level),
                "unit": balance.ingredient.unit,
            },
        )
    logger.info("Daily low-stock scan completed.", extra={"low_stock_balance_count": count})
    return count
