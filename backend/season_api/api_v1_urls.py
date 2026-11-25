from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import CsrfTokenView, LoginView, MeView, logout_view
from reporting.views import DashboardView, ReportEmployeeViewSet, StaffUserViewSet
from seasonops.views import (
    AuditEventViewSet,
    BusinessSettingsView,
    CakeProductViewSet,
    CatalogCategoryViewSet,
    IngredientViewSet,
    InventoryView,
    LocationViewSet,
    MovementViewSet,
    OrderViewSet,
    ProductionViewSet,
    PurchaseViewSet,
    RecipeViewSet,
    SaleViewSet,
    StockAdjustmentView,
    SupplierViewSet,
    TransferViewSet,
)
from website import urls as website_urls

router = DefaultRouter()
router.register("audit", AuditEventViewSet, basename="audit")
router.register("locations", LocationViewSet, basename="location")
router.register("users", ReportEmployeeViewSet, basename="report-employee")
router.register("staff", StaffUserViewSet, basename="staff")
router.register("products", CakeProductViewSet, basename="product")
router.register("catalog-categories", CatalogCategoryViewSet, basename="catalog-category")
router.register("ingredients", IngredientViewSet, basename="ingredient")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("recipes", RecipeViewSet, basename="recipe")
router.register("purchases", PurchaseViewSet, basename="purchase")
router.register("production", ProductionViewSet, basename="production")
router.register("orders", OrderViewSet, basename="order")
router.register("sales", SaleViewSet, basename="sale")
router.register("stock-movements", MovementViewSet, basename="stock-movement")
router.register("transfers", TransferViewSet, basename="transfer")

urlpatterns = [
    path("auth/csrf/", CsrfTokenView.as_view(), name="csrf-token"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("inventory/", InventoryView.as_view(), name="inventory"),
    path("inventory/adjustments/", StockAdjustmentView.as_view(), name="inventory-adjustment"),
    path("business-settings/", BusinessSettingsView.as_view(), name="business-settings"),
    path("", include(website_urls)),
    path("", include(router.urls)),
]
