from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BusinessSettings(models.Model):
    """Singleton row holding business-wide settings (id is always 1)."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    business_name = models.CharField(max_length=120, default="SEASONS CAKE")
    currency = models.CharField(max_length=3, default="NGN")
    tagline = models.CharField(max_length=160, blank=True, default="Delicious & Fresh")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "business settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        self.currency = self.currency.upper()
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "BusinessSettings":
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

    def __str__(self) -> str:
        return self.business_name


class CodeSequence(models.Model):
    """Monotonic human-readable document counters locked with SELECT ... FOR UPDATE."""

    key = models.CharField(max_length=32, primary_key=True)
    value = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.key}={self.value}"
