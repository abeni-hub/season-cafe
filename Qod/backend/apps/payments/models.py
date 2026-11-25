import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.constants import LOCATION_CHOICES, PAYMENT_METHOD_CHOICES
from apps.customers.models import Customer
from apps.orders.models import Order


class PaymentKind(models.TextChoices):
    PAYMENT = "payment", "Payment"
    REFUND = "refund", "Refund"


class PaymentRole(models.TextChoices):
    DEPOSIT = "deposit", "Deposit"
    PARTIAL = "partial", "Partial"
    FINAL = "final", "Final"
    REFUND = "refund", "Refund"


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="payments")
    kind = models.CharField(max_length=10, choices=PaymentKind.choices)
    role = models.CharField(max_length=10, choices=PaymentRole.choices)
    method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES)
    amount_cents = models.BigIntegerField()
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    note = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payments_recorded",
    )
    idempotency_key = models.CharField(max_length=100, null=True, blank=True, unique=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order", "-created_at"]),
            models.Index(fields=["customer", "-created_at"]),
            models.Index(fields=["kind", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount_cents__gt=0), name="payment_amount_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.amount_cents} on {self.order.code}"
