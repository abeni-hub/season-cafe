from django.urls import path

from .views import SupplierListCreateView

urlpatterns = [
    path("suppliers/", SupplierListCreateView.as_view(), name="supplier-list"),
]
