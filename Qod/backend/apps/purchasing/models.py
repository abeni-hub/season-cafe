import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q, F

from apps.core.constants import LOCATION_CHOICES, PAYMENT_METHOD_CHOICES
from apps.core.models import TimeStampedModel
from apps.inventory.models import InventoryItem
from apps.suppliers.models import Supplier


class PurchaseOrder(TimeStampedModel):
    class Status(models.TextChoices):
        ORDERED = "ordered", "Ordered"
        PARTIALLY_RECEIVED = "partially_received", "Partially received"
        RECEIVED = "received", "Received"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.ORDERED)
    expected_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="purchase_orders_created",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"]), models.Index(fields=["supplier"])]

    def __str__(self) -> str:
        return self.code


class PurchaseOrderLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="purchase_lines")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost_cents = models.BigIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["purchase_order", "item"], name="unique_purchase_line_item"
            ),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="purchase_line_qty_positive"),
            models.CheckConstraint(
                condition=Q(unit_cost_cents__gte=0), name="purchase_line_cost_non_negative"
            ),
        ]


class PurchaseReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.PROTECT, related_name="receipts"
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="receipts")
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="purchase_receipts",
    )
    received_by_label = models.CharField(max_length=120, default="System")
    note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        ordering = ["-received_at"]

    def __str__(self) -> str:
        return f"Receipt for {self.purchase_order.code}"


class PurchaseReceiptLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt = models.ForeignKey(PurchaseReceipt, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="receipt_lines")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost_cents = models.BigIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["receipt", "item"], name="unique_receipt_line_item"),
            models.CheckConstraint(condition=Q(quantity__gt=0), name="receipt_line_qty_positive"),
            models.CheckConstraint(
                condition=Q(unit_cost_cents__gte=0), name="receipt_line_cost_non_negative"
            ),
        ]


class SupplierPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="payments")
    amount_cents = models.BigIntegerField()
    method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES)
    note = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="supplier_payments",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount_cents__gt=0), name="supplier_payment_amount_positive"
            )
        ]
