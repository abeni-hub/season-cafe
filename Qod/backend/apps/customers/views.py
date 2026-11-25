from django.db.models import Q
from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.serializers import customer_dict
from apps.orders.models import Order
from apps.payments.services import order_totals
from .models import Customer
from .serializers import CustomerWriteSerializer
from .services import create_customer, update_customer


class CustomerListCreateView(RoleAPIView):
    authorization = "customers.manage"

    def get(self, request):
        queryset = Customer.objects.filter(is_walkin=False)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(organization__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )
        return self.paginate(request, queryset.order_by("name"), customer_dict)

    def post(self, request):
        serializer = CustomerWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = create_customer(actor=request.user, **serializer.validated_data)
        return Response(customer_dict(customer), status=201)


class CustomerDetailView(RoleAPIView):
    authorization = "customers.manage"

    def get(self, request, customer_id):
        customer = Customer.objects.filter(pk=customer_id).first()
        if customer is None:
            raise DomainError("Customer not found.")
        return Response(customer_dict(customer))

    def patch(self, request, customer_id):
        customer = Customer.objects.filter(pk=customer_id).first()
        if customer is None:
            raise DomainError("Customer not found.")
        serializer = CustomerWriteSerializer(data={**customer_dict(customer), **request.data})
        serializer.is_valid(raise_exception=True)
        updated = update_customer(customer, **serializer.validated_data)
        return Response(customer_dict(updated))


class CustomerBalanceView(RoleAPIView):
    authorization = ["customers.manage", "payments.view", "reports.view"]

    def get(self, request, customer_id):
        customer = Customer.objects.filter(pk=customer_id).first()
        if customer is None:
            raise DomainError("Customer not found.")
        balance = 0
        orders = Order.objects.filter(customer=customer).exclude(status="cancelled").prefetch_related(
            "items", "payments"
        )
        for order in orders:
            totals = order_totals(order)
            balance += max(0, totals["balanceCents"])
        return Response({"customerId": str(customer.id), "balanceCents": balance})
