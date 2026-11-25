from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log_activity
from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.pagination import StandardPagination
from apps.core.serializers import product_dict
from .models import Product
from .serializers import ProductUpdateSerializer


class ProductListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Product.objects.all()
        public_only = request.query_params.get("published") in {"1", "true", "yes"}
        if public_only or not request.user.is_authenticated:
            queryset = queryset.filter(is_published=True)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(tagline__icontains=search))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset.order_by("sort_order"), request, view=self)
        if page is not None:
            return paginator.get_paginated_response([product_dict(product) for product in page])
        return Response([product_dict(product) for product in queryset])


class ProductDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if product is None or (not request.user.is_authenticated and not product.is_published):
            return Response({"detail": "Product not found."}, status=404)
        return Response(product_dict(product))


class ProductUpdateView(RoleAPIView):
    authorization = "products.manage"

    def patch(self, request, product_id):
        serializer = ProductUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            raise DomainError("Product not found.")
        data = serializer.validated_data
        if "description" in data:
            product.description = data["description"].strip()
        if "tagline" in data:
            product.tagline = data["tagline"].strip()
        if "priceCents" in data:
            product.price_cents = data["priceCents"]
        if "isPublished" in data:
            product.is_published = data["isPublished"]
        if "isAvailable" in data:
            product.is_available = data["isAvailable"]
        product.save()
        log_activity(f"{product.name} updated by {request.user.name}.", actor=request.user)
        return Response(product_dict(product))
