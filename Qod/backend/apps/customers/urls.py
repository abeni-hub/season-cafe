from django.urls import path

from .views import CustomerBalanceView, CustomerDetailView, CustomerListCreateView

urlpatterns = [
    path("customers/", CustomerListCreateView.as_view(), name="customer-list"),
    path("customers/<uuid:customer_id>/", CustomerDetailView.as_view(), name="customer-detail"),
    path(
        "customers/<uuid:customer_id>/balance/",
        CustomerBalanceView.as_view(),
        name="customer-balance",
    ),
]
