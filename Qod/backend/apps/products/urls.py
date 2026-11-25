from django.urls import path

from .views import ProductDetailView, ProductListCreateView, ProductUpdateView

urlpatterns = [
    path("products/", ProductListCreateView.as_view(), name="product-list"),
    path("products/<uuid:product_id>/", ProductDetailView.as_view(), name="product-detail"),
    path("products/<uuid:product_id>/update/", ProductUpdateView.as_view(), name="product-update"),
]
