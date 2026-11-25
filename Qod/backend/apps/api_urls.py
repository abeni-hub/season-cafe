from django.urls import include, path

from apps.core.views import BootstrapView

urlpatterns = [
    path("bootstrap/", BootstrapView.as_view(), name="bootstrap"),
    path("", include("apps.accounts.urls")),
    path("", include("apps.products.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.orders.urls")),
    path("", include("apps.payments.urls")),
    path("", include("apps.inventory.urls")),
    path("", include("apps.suppliers.urls")),
    path("", include("apps.purchasing.urls")),
    path("", include("apps.recipes.urls")),
    path("", include("apps.production.urls")),
    path("", include("apps.transfers.urls")),
    path("", include("apps.expenses.urls")),
    path("", include("apps.employees.urls")),
    path("", include("apps.reporting.urls")),
    path("", include("apps.website.urls")),
    path("", include("apps.audit.urls")),
]
