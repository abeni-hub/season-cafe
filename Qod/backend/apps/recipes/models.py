import uuid

from django.db import models
from django.db.models import Q

from apps.inventory.models import InventoryItem
from apps.products.models import Product


class Recipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="recipe")
    yield_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    notes = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__sort_order"]
        constraints = [
            models.CheckConstraint(condition=Q(yield_quantity__gt=0), name="recipe_yield_positive")
        ]

    def __str__(self) -> str:
        return f"Recipe for {self.product.name}"


class RecipeLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="recipe_lines")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["recipe", "item"], name="unique_recipe_line_item"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="recipe_line_qty_positive"),
        ]
