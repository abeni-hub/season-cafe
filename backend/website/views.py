import hashlib
import json
import mimetypes

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from seasonops.models import CakeProduct, CatalogCategory
from seasonops.permissions import HasBusinessPermission
from seasonops.services import log_activity

from .models import (
    CustomerInquiry,
    WebsiteBanner,
    WebsiteGalleryItem,
    WebsiteSection,
    WebsiteSettings,
    WebsiteTestimonial,
)
from .serializers import (
    CustomerInquiryCreateSerializer,
    CustomerInquirySerializer,
    PublicWebsiteSettingsSerializer,
    WebsiteBannerSerializer,
    WebsiteGalleryItemSerializer,
    WebsiteSectionSerializer,
    WebsiteSettingsSerializer,
    WebsiteTestimonialSerializer,
)


def _absolute_image(request, image):
    if not image:
        return ""
    url = image.url
    return request.build_absolute_uri(url) if request else url


def _serialize_product(request, product):
    return {
        "id": product.web_id,
        "name": product.name,
        "description": product.description,
        "image": _absolute_image(request, product.image),
        "image_alt": product.image_alt,
        "category": product.category.name if product.category_id else "",
        "category_id": product.category_id,
        "price": str(product.unit_price) if product.unit_price is not None else None,
        "featured": product.is_featured,
    }


def _serialize_category(category):
    return {"id": category.pk, "name": category.name, "sort_order": category.sort_order}


def _serialize_content_item(request, item):
    data = {
        field: getattr(item, field)
        for field in (
            "id",
            "eyebrow",
            "title",
            "body",
            "image_alt",
            "cta_label",
            "cta_url",
            "sort_order",
        )
        if hasattr(item, field)
    }
    if hasattr(item, "image"):
        data["image"] = _absolute_image(request, item.image)
    if hasattr(item, "slug"):
        data["slug"] = item.slug
    if hasattr(item, "kind"):
        data["kind"] = item.kind
    return data


def _public_website_payload(request, include_drafts=False):
    settings = WebsiteSettings.objects.filter(pk=1).first()
    if not include_drafts and (settings is None or not settings.is_published):
        return {"cms_active": False}

    now = timezone.now()
    products = CakeProduct.objects.select_related("category").filter(
        is_active=True,
        is_published=True,
        web_id__isnull=False,
    )
    categories = CatalogCategory.objects.filter(
        kind=CatalogCategory.Kind.PRODUCT,
        is_active=True,
        is_published=True,
    )
    if not include_drafts:
        products = products.filter(Q(category__isnull=True) | Q(category__in=categories))
    products = products.order_by("public_sort_order", "name", "id")
    if include_drafts:
        products = CakeProduct.objects.select_related("category").all().order_by(
            "public_sort_order",
            "name",
            "id",
        )
        categories = CatalogCategory.objects.filter(kind=CatalogCategory.Kind.PRODUCT)

    banners = WebsiteBanner.objects.all()
    sections = WebsiteSection.objects.all()
    gallery = WebsiteGalleryItem.objects.all()
    testimonials = WebsiteTestimonial.objects.all()
    if not include_drafts:
        banners = banners.filter(is_published=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True) | Q(ends_at__gte=now),
        )
        sections = sections.filter(is_published=True)
        gallery = gallery.filter(is_published=True)
        testimonials = testimonials.filter(is_published=True, is_approved=True)

    settings_data = None
    if settings:
        settings_data = (
            WebsiteSettingsSerializer(settings, context={"request": request}).data
            if include_drafts
            else PublicWebsiteSettingsSerializer(settings, context={"request": request}).data
        )

    return {
        "cms_active": bool(settings and settings.is_published),
        "settings": settings_data,
        "categories": [_serialize_category(category) for category in categories.order_by("sort_order", "name")],
        "products": [_serialize_product(request, product) for product in products],
        "banners": [_serialize_content_item(request, banner) for banner in banners],
        "sections": [_serialize_content_item(request, section) for section in sections],
        "gallery": [
            {
                "id": item.pk,
                "image": _absolute_image(request, item.image),
                "alt_text": item.alt_text,
                "sort_order": item.sort_order,
            }
            for item in gallery.order_by("sort_order", "id")
        ],
        "testimonials": [
            {
                "id": item.pk,
                "quote": item.quote,
                "customer_name": item.customer_name,
                "sort_order": item.sort_order,
            }
            for item in testimonials.order_by("sort_order", "id")
        ],
    }


class PublicWebsiteView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_content"

    def get(self, request):
        return Response(_public_website_payload(request))


class PublishedMediaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, path):
        website_live = WebsiteSettings.objects.filter(pk=1, is_published=True).exists()
        public_file = False
        image_field = None

        if website_live:
            products = CakeProduct.objects.filter(
                image=path,
                is_active=True,
                is_published=True,
                web_id__isnull=False,
            ).filter(Q(category__isnull=True) | Q(category__is_active=True, category__is_published=True))
            image_field = products.first().image if products.exists() else None
            if image_field:
                public_file = True

            if image_field is None:
                settings = WebsiteSettings.objects.filter(pk=1, is_published=True).first()
                if settings and settings.hero_image.name == path:
                    image_field = settings.hero_image
                    public_file = True
                elif settings and settings.about_image.name == path:
                    image_field = settings.about_image
                    public_file = True

            if image_field is None:
                now = timezone.now()
                banners = WebsiteBanner.objects.filter(image=path, is_published=True).filter(
                    Q(starts_at__isnull=True) | Q(starts_at__lte=now),
                    Q(ends_at__isnull=True) | Q(ends_at__gte=now),
                )
                sections = WebsiteSection.objects.filter(image=path, is_published=True)
                gallery = WebsiteGalleryItem.objects.filter(image=path, is_published=True)
                image_field = (
                    banners.first().image if banners.exists()
                    else sections.first().image if sections.exists()
                    else gallery.first().image if gallery.exists()
                    else None
                )
                public_file = image_field is not None

        permissions = request.user.effective_business_permissions if request.user.is_authenticated else set()
        if image_field is None and "website_content" in permissions:
            settings = WebsiteSettings.objects.filter(hero_image=path).first()
            if settings:
                image_field = settings.hero_image
            if image_field is None:
                settings = WebsiteSettings.objects.filter(about_image=path).first()
                if settings:
                    image_field = settings.about_image
            if image_field is None:
                for queryset in (
                    WebsiteBanner.objects.filter(image=path),
                    WebsiteSection.objects.filter(image=path),
                    WebsiteGalleryItem.objects.filter(image=path),
                ):
                    item = queryset.first()
                    if item:
                        image_field = item.image
                        break
        if image_field is None and "catalog" in permissions:
            product = CakeProduct.objects.filter(image=path).first()
            image_field = product.image if product else None

        if image_field is None or not image_field.storage.exists(image_field.name):
            raise Http404
        try:
            image = image_field.open("rb")
        except OSError:
            raise Http404 from None
        content_type = mimetypes.guess_type(image_field.name)[0] or "application/octet-stream"
        response = FileResponse(image, content_type=content_type)
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "public, max-age=3600" if public_file else "private, no-store"
        return response


class WebsitePreviewView(APIView):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "website_content"

    def get(self, request):
        return Response(_public_website_payload(request, include_drafts=True))


class WebsiteSettingsView(APIView):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "website_content"
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        settings = WebsiteSettings.objects.filter(pk=1).first() or WebsiteSettings(pk=1)
        return Response(WebsiteSettingsSerializer(settings, context={"request": request}).data)

    def put(self, request):
        return self._save(request, partial=False)

    def patch(self, request):
        return self._save(request, partial=True)

    @transaction.atomic
    def _save(self, request, partial):
        settings = WebsiteSettings.objects.filter(pk=1).first() or WebsiteSettings(pk=1)
        was_published = settings.is_published
        serializer = WebsiteSettingsSerializer(
            settings,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        settings = serializer.save(updated_by=request.user)
        action = "website_settings_update"
        if settings.is_published and not was_published:
            action = "website_publish"
        elif was_published and not settings.is_published:
            action = "website_unpublish"
        summaries = {
            "website_publish": "Published website content.",
            "website_unpublish": "Unpublished website content.",
            "website_settings_update": "Updated website settings.",
        }
        log_activity(
            location=None,
            actor=request.user,
            action=action,
            summary=summaries[action],
            target_type="website_settings",
            target_id=settings.pk,
        )
        return Response(WebsiteSettingsSerializer(settings, context={"request": request}).data)


class AuditedContentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "website_content"
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    audit_type = "website_content"

    @transaction.atomic
    def perform_create(self, serializer):
        item = serializer.save(updated_by=self.request.user)
        published = getattr(item, "is_published", False)
        action = f"{self.audit_type}_{'publish' if published else 'create'}"
        log_activity(
            location=None,
            actor=self.request.user,
            action=action,
            summary=f"{'Published' if published else 'Created'} public website content: {item}.",
            target_type=self.audit_type,
            target_id=item.pk,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        was_published = getattr(serializer.instance, "is_published", False)
        item = serializer.save(updated_by=self.request.user)
        is_published = getattr(item, "is_published", False)
        action = f"{self.audit_type}_update"
        if is_published and not was_published:
            action = f"{self.audit_type}_publish"
        elif was_published and not is_published:
            action = f"{self.audit_type}_unpublish"
        log_activity(
            location=None,
            actor=self.request.user,
            action=action,
            summary=f"Updated public website content: {item}.",
            target_type=self.audit_type,
            target_id=item.pk,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        item_id = instance.pk
        label = str(instance)
        instance.delete()
        log_activity(
            location=None,
            actor=self.request.user,
            action=f"{self.audit_type}_delete",
            summary=f"Deleted public website content: {label}.",
            target_type=self.audit_type,
            target_id=item_id,
        )


class WebsiteBannerViewSet(AuditedContentViewSet):
    queryset = WebsiteBanner.objects.all()
    serializer_class = WebsiteBannerSerializer
    search_fields = ["title", "body"]
    ordering_fields = ["sort_order", "created_at", "updated_at"]
    audit_type = "website_banner"


class WebsiteSectionViewSet(AuditedContentViewSet):
    queryset = WebsiteSection.objects.all()
    serializer_class = WebsiteSectionSerializer
    search_fields = ["slug", "title", "body"]
    ordering_fields = ["sort_order", "created_at", "updated_at"]
    audit_type = "website_section"


class WebsiteGalleryItemViewSet(AuditedContentViewSet):
    queryset = WebsiteGalleryItem.objects.all()
    serializer_class = WebsiteGalleryItemSerializer
    ordering_fields = ["sort_order", "created_at"]
    audit_type = "website_gallery"


class WebsiteTestimonialViewSet(AuditedContentViewSet):
    queryset = WebsiteTestimonial.objects.all()
    serializer_class = WebsiteTestimonialSerializer
    search_fields = ["customer_name", "quote"]
    ordering_fields = ["sort_order", "created_at"]
    audit_type = "website_testimonial"


class CustomerInquiryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = CustomerInquiry.objects.select_related("assigned_to").all()
    serializer_class = CustomerInquirySerializer
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "inquiries"
    search_fields = ["name", "email", "phone", "subject", "message"]
    ordering_fields = ["created_at", "updated_at", "status"]

    @transaction.atomic
    def perform_update(self, serializer):
        inquiry = serializer.save()
        log_activity(
            location=None,
            actor=self.request.user,
            action="customer_inquiry_update",
            summary=f"Updated website inquiry #{inquiry.pk} to {inquiry.status}.",
            target_type="customer_inquiry",
            target_id=inquiry.pk,
        )


class PublicInquiryView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_inquiry"

    def post(self, request):
        serializer = CustomerInquiryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        key = data["idempotencyKey"]
        payload = {
            "name": data["name"],
            "email": data["email"],
            "phone": data.get("phone", ""),
            "subject": data.get("subject", ""),
            "message": data["message"],
        }
        fingerprint = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(),
        ).hexdigest()
        defaults = {**payload, "request_fingerprint": fingerprint}
        try:
            with transaction.atomic():
                inquiry, created = CustomerInquiry.objects.get_or_create(
                    idempotency_key=key,
                    defaults=defaults,
                )
                if created:
                    log_activity(
                        location=None,
                        actor=None,
                        action="customer_inquiry_create",
                        summary="Received a customer inquiry from the public website.",
                        target_type="customer_inquiry",
                        target_id=inquiry.pk,
                    )
        except IntegrityError:
            inquiry = CustomerInquiry.objects.filter(idempotency_key=key).first()
            if inquiry is None:
                raise
            created = False
        if inquiry is None:
            raise ValidationError({"idempotencyKey": "This request could not be saved. Please try again."})
        if inquiry.request_fingerprint != fingerprint:
            raise ValidationError({"idempotencyKey": "This key was already used for a different inquiry."})
        return Response(
            {"id": inquiry.pk, "received": True},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
