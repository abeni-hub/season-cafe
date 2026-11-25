from urllib.parse import urlparse

from rest_framework import serializers

from .models import (
    CustomerInquiry,
    WebsiteBanner,
    WebsiteGalleryItem,
    WebsiteSection,
    WebsiteSettings,
    WebsiteTestimonial,
)


def _validate_public_link(value):
    if not value:
        return
    parsed = urlparse(value)
    if value.startswith("#") or (value.startswith("/") and not value.startswith("//")):
        return
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise serializers.ValidationError("Use a website URL, an internal path, or a section link.")


def _validate_image_size(image):
    if image and image.size > 5 * 1024 * 1024:
        raise serializers.ValidationError("Choose an image smaller than 5 MB.")


class WebsiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteSettings
        exclude = ["id"]
        read_only_fields = ["updated_by", "updated_at", "published_at"]

    def validate(self, attrs):
        for field in ("hero_cta_url",):
            _validate_public_link(attrs.get(field, getattr(self.instance, field, "")))
        for field in ("hero_image", "about_image"):
            _validate_image_size(attrs.get(field))
        is_published = attrs.get("is_published", getattr(self.instance, "is_published", False))
        if is_published:
            hero_title = attrs.get("hero_title", getattr(self.instance, "hero_title", "")).strip()
            menu_title = attrs.get("menu_title", getattr(self.instance, "menu_title", "")).strip()
            if not hero_title or not menu_title:
                raise serializers.ValidationError(
                    {"is_published": "Add a homepage title and menu title before publishing the website."},
                )
        return attrs


class PublicWebsiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteSettings
        fields = [
            "site_name",
            "hero_eyebrow",
            "hero_title",
            "hero_body",
            "hero_image",
            "hero_image_alt",
            "hero_cta_label",
            "hero_cta_url",
            "about_eyebrow",
            "about_title",
            "about_body",
            "about_image",
            "about_image_alt",
            "menu_eyebrow",
            "menu_title",
            "menu_body",
            "featured_eyebrow",
            "featured_title",
            "featured_body",
            "gallery_eyebrow",
            "gallery_title",
            "gallery_body",
            "trust_eyebrow",
            "trust_title",
            "trust_body",
            "contact_eyebrow",
            "contact_title",
            "contact_body",
            "phone",
            "email",
            "address",
            "opening_hours",
            "instagram_url",
            "facebook_url",
        ]


class WebsiteBannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteBanner
        fields = [
            "id",
            "eyebrow",
            "title",
            "body",
            "image",
            "image_alt",
            "cta_label",
            "cta_url",
            "sort_order",
            "is_published",
            "starts_at",
            "ends_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        _validate_public_link(attrs.get("cta_url", getattr(self.instance, "cta_url", "")))
        _validate_image_size(attrs.get("image"))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "The end time must be after the start time."})
        return attrs


class WebsiteSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteSection
        fields = [
            "id",
            "slug",
            "kind",
            "eyebrow",
            "title",
            "body",
            "image",
            "image_alt",
            "cta_label",
            "cta_url",
            "sort_order",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        _validate_public_link(attrs.get("cta_url", getattr(self.instance, "cta_url", "")))
        _validate_image_size(attrs.get("image"))
        return attrs


class WebsiteGalleryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteGalleryItem
        fields = ["id", "image", "alt_text", "sort_order", "is_published", "created_at"]
        read_only_fields = ["created_at"]

    def validate_image(self, value):
        _validate_image_size(value)
        return value


class WebsiteTestimonialSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteTestimonial
        fields = ["id", "quote", "customer_name", "is_approved", "is_published", "sort_order", "created_at"]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        is_published = attrs.get("is_published", getattr(self.instance, "is_published", False))
        is_approved = attrs.get("is_approved", getattr(self.instance, "is_approved", False))
        if is_published and not is_approved:
            raise serializers.ValidationError({"is_published": "Approve the testimonial before publishing it."})
        return attrs


class CustomerInquiryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160, trim_whitespace=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=40, trim_whitespace=True, required=False, allow_blank=True)
    subject = serializers.CharField(max_length=200, trim_whitespace=True, required=False, allow_blank=True)
    message = serializers.CharField(max_length=5000, trim_whitespace=True)
    idempotencyKey = serializers.CharField(max_length=80)

    def create(self, validated_data):
        validated_data.pop("idempotencyKey")
        return CustomerInquiry.objects.create(**validated_data)


class CustomerInquirySerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.username", read_only=True, default="")

    class Meta:
        model = CustomerInquiry
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "subject",
            "message",
            "status",
            "source",
            "assigned_to",
            "assigned_to_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "name",
            "email",
            "phone",
            "subject",
            "message",
            "source",
            "assigned_to",
            "created_at",
            "updated_at",
        ]
