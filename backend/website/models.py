from django.conf import settings
from django.db import models
from django.utils import timezone


class WebsiteSettings(models.Model):
    site_name = models.CharField(max_length=120, default="Season Cake")
    is_published = models.BooleanField(default=False)
    hero_eyebrow = models.CharField(max_length=120, blank=True)
    hero_title = models.CharField(max_length=240, blank=True)
    hero_body = models.TextField(blank=True)
    hero_image = models.ImageField(upload_to="website/hero/", blank=True)
    hero_image_alt = models.CharField(max_length=240, blank=True)
    hero_cta_label = models.CharField(max_length=80, blank=True)
    hero_cta_url = models.CharField(max_length=300, blank=True)
    about_eyebrow = models.CharField(max_length=120, blank=True)
    about_title = models.CharField(max_length=240, blank=True)
    about_body = models.TextField(blank=True)
    about_image = models.ImageField(upload_to="website/about/", blank=True)
    about_image_alt = models.CharField(max_length=240, blank=True)
    menu_eyebrow = models.CharField(max_length=120, blank=True)
    menu_title = models.CharField(max_length=240, blank=True)
    menu_body = models.TextField(blank=True)
    featured_eyebrow = models.CharField(max_length=120, blank=True)
    featured_title = models.CharField(max_length=240, blank=True)
    featured_body = models.TextField(blank=True)
    gallery_eyebrow = models.CharField(max_length=120, blank=True)
    gallery_title = models.CharField(max_length=240, blank=True)
    gallery_body = models.TextField(blank=True)
    trust_eyebrow = models.CharField(max_length=120, blank=True)
    trust_title = models.CharField(max_length=240, blank=True)
    trust_body = models.TextField(blank=True)
    contact_eyebrow = models.CharField(max_length=120, blank=True)
    contact_title = models.CharField(max_length=240, blank=True)
    contact_body = models.TextField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=240, blank=True)
    opening_hours = models.CharField(max_length=240, blank=True)
    instagram_url = models.URLField(max_length=300, blank=True)
    facebook_url = models.URLField(max_length=300, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="website_settings_updates",
    )
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "website settings"
        verbose_name_plural = "website settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        elif not self.is_published:
            self.published_at = None
        super().save(*args, **kwargs)

    def __str__(self):
        return self.site_name


class WebsiteBanner(models.Model):
    eyebrow = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=240)
    body = models.TextField(blank=True)
    image = models.ImageField(upload_to="website/banners/", blank=True)
    image_alt = models.CharField(max_length=240, blank=True)
    cta_label = models.CharField(max_length=80, blank=True)
    cta_url = models.CharField(max_length=300, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="website_banner_updates",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title


class WebsiteSection(models.Model):
    class Kind(models.TextChoices):
        CONTENT = "content", "Content"
        PROMOTION = "promotion", "Promotion"

    slug = models.SlugField(max_length=100, unique=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.CONTENT)
    eyebrow = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=240)
    body = models.TextField(blank=True)
    image = models.ImageField(upload_to="website/sections/", blank=True)
    image_alt = models.CharField(max_length=240, blank=True)
    cta_label = models.CharField(max_length=80, blank=True)
    cta_url = models.CharField(max_length=300, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="website_section_updates",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title


class WebsiteGalleryItem(models.Model):
    image = models.ImageField(upload_to="website/gallery/")
    alt_text = models.CharField(max_length=240)
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="website_gallery_updates",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.alt_text


class WebsiteTestimonial(models.Model):
    quote = models.TextField()
    customer_name = models.CharField(max_length=120)
    is_approved = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="website_testimonial_updates",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.customer_name


class CustomerInquiry(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        RESOLVED = "resolved", "Resolved"

    name = models.CharField(max_length=160)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True)
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField(max_length=5000)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    source = models.CharField(max_length=20, default="website")
    idempotency_key = models.CharField(max_length=80, unique=True)
    request_fingerprint = models.CharField(max_length=64)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_website_inquiries",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name}: {self.subject or self.message[:50]}"
