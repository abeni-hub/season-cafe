from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import api_v1_urls
from .health import liveness, readiness
from seasonops.views import PublicOrderRequestView
from website.views import PublishedMediaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/live/", liveness, name="health-live"),
    path("health/ready/", readiness, name="health-ready"),
    re_path(r"^orders/?$", PublicOrderRequestView.as_view(), name="public-order-request"),
    re_path(r"^media/(?P<path>.+)$", PublishedMediaView.as_view(), name="protected-media"),
    path(
        "api/v1/schema/",
        SpectacularAPIView.as_view(api_version="v1"),
        name="api-v1-schema",
    ),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="api-v1-schema"),
        name="api-v1-docs",
    ),
    path("api/v1/", include((api_v1_urls.urlpatterns, "api"), namespace="v1")),
    path("api/auth/csrf/", api_v1_urls.CsrfTokenView.as_view(), name="csrf-token"),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
    path("api/auth/login/", api_v1_urls.LoginView.as_view(), name="api-login"),
    path("api/auth/logout/", api_v1_urls.logout_view, name="api-logout"),
    path("api/auth/me/", api_v1_urls.MeView.as_view(), name="api-me"),
    path("api/dashboard/", api_v1_urls.DashboardView.as_view(), name="dashboard"),
    path("api/inventory/", api_v1_urls.InventoryView.as_view(), name="inventory"),
    path(
        "api/inventory/adjustments/",
        api_v1_urls.StockAdjustmentView.as_view(),
        name="inventory-adjustment",
    ),
    path("api/business-settings/", api_v1_urls.BusinessSettingsView.as_view(), name="business-settings"),
    path("api/", include(api_v1_urls.urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
