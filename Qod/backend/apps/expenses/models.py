import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.constants import LOCATION_CHOICES


class ExpenseCategory(models.TextChoices):
    INGREDIENTS = "ingredients", "Ingredients"
    PACKAGING = "packaging", "Packaging"
    UTILITIES = "utilities", "Utilities"
    RENT = "rent", "Rent"
    SALARIES = "salaries", "Salaries"
    MARKETING = "marketing", "Marketing"
    OTHER = "other", "Other"


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.CharField(max_length=20, choices=ExpenseCategory.choices)
    amount_cents = models.BigIntegerField()
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    note = models.CharField(max_length=300)
    incurred_at = models.DateField(db_index=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="expenses_recorded",
    )
    recorded_by_label = models.CharField(max_length=120, default="System")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-incurred_at", "-created_at"]
        indexes = [models.Index(fields=["category", "-incurred_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(amount_cents__gt=0), name="expense_amount_positive")
        ]

    def __str__(self) -> str:
        return f"{self.category} {self.amount_cents}"
