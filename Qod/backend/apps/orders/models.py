import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.constants import LOCATION_CHOICES
from apps.core.models import TimeStampedModel
from apps.customers.models import Customer
from apps.products.models import Product


class OrderType(models.TextChoices):
    REGULAR = "regular", "Regular sale"
    CUSTOM = "custom", "Custom cake"
    BULK = "bulk", "Bulk order"
    ORGANIZATIONAL = "organizational", "Organizational"


class OrderStatus(models.TextChoices):
    INQUIRY = "inquiry", "Inquiry"
    QUOTED = "quoted", "Quoted"
    CONFIRMED = "confirmed", "Confirmed"
    IN_PRODUCTION = "in_production", "In production"
    READY = "ready", "Ready"
    FULFILLED = "fulfilled", "Fulfilled"
    CANCELLED = "cancelled", "Cancelled"


class OrderSource(models.TextChoices):
    POS = "pos", "POS"
    BMS = "bms", "BMS"
    WEBSITE = "website", "Website"


class Order(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    type = models.CharField(max_length=20, choices=OrderType.choices, default=OrderType.REGULAR)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.INQUIRY)
    source = models.CharField(max_length=20, choices=OrderSource.choices, default=OrderSource.BMS)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="orders")
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, default="home_bakery")
    delivery_location = models.CharField(max_length=20, choices=LOCATION_CHOICES, blank=True, default="")
    delivery_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    idempotency_key = models.CharField(max_length=100, null=True, blank=True, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders_created",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["customer", "-created_at"]),
            models.Index(fields=["code"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(source__in=["pos", "bms", "website"]), name="order_source_valid"
            )
        ]

    def __str__(self) -> str:
        return self.code


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL, related_name="order_items"
    )
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price_cents = models.BigIntegerField(default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="orderitem_qty_positive"),
            models.CheckConstraint(
                condition=Q(unit_price_cents__gte=0), name="orderitem_price_non_negative"
            ),
        ]

    @property
    def line_total_cents(self) -> int:
        return int(round(float(self.quantity) * self.unit_price_cents))
