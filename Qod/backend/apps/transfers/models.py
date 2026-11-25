import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q

from apps.core.constants import LOCATION_CHOICES
from apps.core.models import TimeStampedModel
from apps.inventory.models import InventoryItem


class TransferStatus(models.TextChoices):
    REQUESTED = "requested", "Requested"
    APPROVED = "approved", "Approved"
    DISPATCHED = "dispatched", "Dispatched"
    RECEIVED = "received", "Received"
    CANCELLED = "cancelled", "Cancelled"


class Transfer(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    from_location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    to_location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    status = models.CharField(max_length=20, choices=TransferStatus.choices, default=TransferStatus.REQUESTED)
    notes = models.TextField(blank=True, default="")
    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transfers_created",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=~Q(from_location=F("to_location")), name="transfer_locations_differ"
            )
        ]


class TransferLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transfer = models.ForeignKey(Transfer, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="transfer_lines")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["transfer", "item"], name="unique_transfer_line_item"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="transfer_line_qty_positive"),
        ]
