import uuid

from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.core.models import TimeStampedModel


class CustomerKind(models.TextChoices):
    INDIVIDUAL = "individual", "Individual"
    ORGANIZATION = "organization", "Organization"


class Customer(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=CustomerKind.choices, default=CustomerKind.INDIVIDUAL)
    name = models.CharField(max_length=160)
    organization = models.CharField(max_length=160, blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.CharField(max_length=300, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    is_walkin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["kind"]),
            models.Index(fields=["email"]),
            models.Index(fields=["phone"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["is_walkin"],
                condition=Q(is_walkin=True),
                name="unique_walkin_customer",
            ),
            models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="unique_customer_email_ci",
            ),
        ]

    def __str__(self) -> str:
        return self.organization or self.name
