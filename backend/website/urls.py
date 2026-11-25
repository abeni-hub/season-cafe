from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CustomerInquiryViewSet,
    PublicInquiryView,
    PublicWebsiteView,
    WebsiteBannerViewSet,
    WebsiteGalleryItemViewSet,
    WebsitePreviewView,
    WebsiteSectionViewSet,
    WebsiteSettingsView,
    WebsiteTestimonialViewSet,
)

router = DefaultRouter()
router.register("website/banners", WebsiteBannerViewSet, basename="website-banner")
router.register("website/sections", WebsiteSectionViewSet, basename="website-section")
router.register("website/gallery", WebsiteGalleryItemViewSet, basename="website-gallery")
router.register("website/testimonials", WebsiteTestimonialViewSet, basename="website-testimonial")
router.register("website/inquiries", CustomerInquiryViewSet, basename="website-inquiry")

urlpatterns = [
    path("public/site/", PublicWebsiteView.as_view(), name="public-site"),
    path("public/inquiries/", PublicInquiryView.as_view(), name="public-inquiry"),
    path("website/settings/", WebsiteSettingsView.as_view(), name="website-settings"),
    path("website/preview/", WebsitePreviewView.as_view(), name="website-preview"),
    *router.urls,
]
