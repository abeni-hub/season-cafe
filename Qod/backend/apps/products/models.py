import uuid

from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel
from .constants import SEVEN_SLUGS


class Product(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    tagline = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    price_cents = models.BigIntegerField()
    is_published = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    art_index = models.PositiveSmallIntegerField(default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        indexes = [models.Index(fields=["is_published", "sort_order"])]
        constraints = [
            models.CheckConstraint(condition=Q(price_cents__gt=0), name="product_price_positive"),
            models.CheckConstraint(condition=Q(slug__in=SEVEN_SLUGS), name="product_seven_slugs"),
        ]

    def __str__(self) -> str:
        return self.name
