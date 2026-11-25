import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.constants import LOCATION_CHOICES
from apps.core.models import TimeStampedModel
from apps.products.models import Product


class ItemKind(models.TextChoices):
    RAW = "raw", "Raw material"
    PACKAGING = "packaging", "Packaging"
    FINISHED = "finished", "Finished good"


class Unit(models.TextChoices):
    KG = "kg", "kg"
    G = "g", "g"
    L = "l", "l"
    ML = "ml", "ml"
    PCS = "pcs", "pcs"


class MovementReason(models.TextChoices):
    OPENING = "opening", "Opening stock"
    PURCHASE_RECEIPT = "purchase_receipt", "Purchase receipt"
    PRODUCTION_CONSUMPTION = "production_consumption", "Production consumption"
    PRODUCTION_OUTPUT = "production_output", "Production output"
    SALE = "sale", "Sale"
    RETURN = "return", "Return"
    TRANSFER_OUT = "transfer_out", "Transfer out"
    TRANSFER_IN = "transfer_in", "Transfer in"
    ADJUSTMENT = "adjustment", "Adjustment"
    WASTAGE = "wastage", "Wastage"


class InventoryItem(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=160)
    kind = models.CharField(max_length=20, choices=ItemKind.choices)
    unit = models.CharField(max_length=5, choices=Unit.choices)
    cost_per_unit_cents = models.BigIntegerField(default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    product = models.OneToOneField(
        Product,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="finished_item",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sku"]
        indexes = [models.Index(fields=["kind"]), models.Index(fields=["name"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(cost_per_unit_cents__gte=0), name="inventory_cost_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(reorder_level__gte=0), name="inventory_reorder_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(kind="finished", product__isnull=False)
                | ~Q(kind="finished"),
                name="finished_item_requires_product",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sku} {self.name}"


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="movements")
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    quantity_delta = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(max_length=30, choices=MovementReason.choices)
    ref_id = models.UUIDField(null=True, blank=True, db_index=True)
    # Internal idempotency scope. For purchases this is the receipt id so a
    # purchase order can be received in several deliveries; ref_id stays the
    # purchase order id shown in the UI.
    event_id = models.UUIDField(null=True, blank=True)
    note = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements",
    )
    created_by_label = models.CharField(max_length=120, default="System")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["item", "location"]),
            models.Index(fields=["reason", "ref_id"]),
            models.Index(fields=["-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(quantity_delta=0), name="movement_quantity_non_zero"
            ),
            models.UniqueConstraint(
                fields=["reason", "event_id", "item", "location"],
                condition=Q(event_id__isnull=False),
                name="unique_movement_per_event",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item.sku} {self.quantity_delta} {self.reason}"
