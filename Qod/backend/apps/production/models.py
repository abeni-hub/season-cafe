import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.constants import LOCATION_CHOICES
from apps.core.models import TimeStampedModel
from apps.orders.models import Order
from apps.products.models import Product
from apps.recipes.models import Recipe


class BatchStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SCHEDULED = "scheduled", "Scheduled"
    IN_PRODUCTION = "in_production", "In production"
    QUALITY_CHECK = "quality_check", "Quality check"
    COMPLETED = "completed", "Completed"
    READY = "ready", "Ready"
    CANCELLED = "cancelled", "Cancelled"


class ProductionBatch(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=160)
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL, related_name="batches"
    )
    recipe = models.ForeignKey(
        Recipe, null=True, blank=True, on_delete=models.PROTECT, related_name="batches"
    )
    order = models.ForeignKey(
        Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="batches"
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, default="home_bakery")
    status = models.CharField(max_length=20, choices=BatchStatus.choices, default=BatchStatus.PENDING)
    assigned_employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="batches_assigned",
    )
    scheduled_for = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    quality_note = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="batches_created",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["order"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="batch_qty_positive")
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.title}"
