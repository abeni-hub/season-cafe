from django.db.models import Q
from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.serializers import supplier_dict
from apps.purchasing.services import create_supplier
from .models import Supplier
from .serializers import SupplierCreateSerializer


class SupplierListCreateView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request):
        queryset = Supplier.objects.all()
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(contact_name__icontains=search)
                | Q(email__icontains=search)
            )
        return self.paginate(request, queryset.order_by("name"), supplier_dict)

    def post(self, request):
        serializer = SupplierCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        supplier = create_supplier(actor=request.user, **serializer.validated_data)
        return Response(supplier_dict(supplier), status=201)
