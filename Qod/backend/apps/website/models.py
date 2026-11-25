import uuid

from django.db import models

DEFAULT_GALLERY_CAPTIONS = [
    "Counter bake — demo caption",
    "Botanical palette — demo caption",
    "Custard finish — demo caption",
    "Pastry layers — demo caption",
    "Celebration cake — demo caption",
    "Seasonal fruit — demo caption",
]


class SiteContent(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    hero_eyebrow = models.CharField(max_length=120, default="Botanical patisserie")
    hero_title = models.CharField(max_length=160, default="Baked with the seasons")
    hero_lead = models.TextField(
        default=(
            "Custards, mille-feuille and tarts made fresh at our home bakery — served at the "
            "counter and finished by hand."
        )
    )
    about_title = models.CharField(max_length=160, default="A bakery built around freshness")
    about_lead = models.TextField(
        default=(
            "Seasons Cake is a botanical patisserie working from a home bakery, with a café "
            "counter for the everyday bake."
        )
    )
    about_body = models.TextField(
        default=(
            "Our catalogue stays deliberately small: seven bakes we can make well, every single "
            "day. Fruit follows the season, cream is whipped to order, and pastry is baked in "
            "small batches. For celebrations, corporate gifting and larger gatherings we take "
            "custom and organisational orders with a written quotation."
        )
    )
    custom_order_note = models.TextField(
        default=(
            "Share the occasion, headcount and any style references. We will respond with "
            "availability and a written quotation; no payment is taken through this form."
        )
    )
    contact_phone = models.CharField(max_length=60, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_address = models.CharField(max_length=300, blank=True, default="")
    opening_hours = models.CharField(max_length=200, blank=True, default="")
    gallery_captions = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "site content"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "SiteContent":
        content, created = cls.objects.get_or_create(
            pk=1, defaults={"gallery_captions": list(DEFAULT_GALLERY_CAPTIONS)}
        )
        if created or not content.gallery_captions:
            content.gallery_captions = list(DEFAULT_GALLERY_CAPTIONS)
            content.save(update_fields=["gallery_captions"])
        return content


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    subject = models.CharField(max_length=200)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.subject} — {self.name}"
