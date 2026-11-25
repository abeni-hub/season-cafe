from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.serializers import order_dict, payment_dict
from apps.core.throttles import PublicWriteThrottle
from apps.payments.models import Payment
from apps.payments.services import order_totals
from .models import Order
from .serializers import (
    CustomInquirySerializer,
    OrderCreateSerializer,
    QuotationSerializer,
    SaleSerializer,
    TransitionSerializer,
)
from .services import (
    cancel_order,
    create_inquiry,
    create_order,
    create_sale,
    save_quotation,
    transition_order,
)


class OrderListCreateView(RoleAPIView):
    authorization = "orders.view"

    def get(self, request):
        queryset = Order.objects.prefetch_related("items").all()
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        type_param = request.query_params.get("type")
        if type_param:
            queryset = queryset.filter(type=type_param)
        customer = request.query_params.get("customer")
        if customer:
            queryset = queryset.filter(customer_id=customer)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(customer__organization__icontains=search)
            )
        ordering = request.query_params.get("ordering", "-created_at")
        if ordering not in {"created_at", "-created_at", "code", "-code"}:
            ordering = "-created_at"
        return self.paginate(request, queryset.order_by(ordering), order_dict)


class OrderCreateView(RoleAPIView):
    authorization = "orders.manage"

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = create_order(
            order_type=data["type"],
            customer_id=data["customerId"],
            items=data["items"],
            location=data["location"],
            status=data["status"],
            delivery_location=data.get("deliveryLocation", ""),
            delivery_date=data.get("deliveryDate"),
            notes=data.get("notes", ""),
            actor=request.user,
        )
        return Response(order_dict(order), status=201)


class OrderDetailView(RoleAPIView):
    authorization = "orders.view"

    def get(self, request, order_id):
        order = Order.objects.prefetch_related("items").filter(pk=order_id).first()
        if order is None:
            raise DomainError("Order not found.")
        payments = Payment.objects.filter(order=order).order_by("-created_at")
        payload = order_dict(order)
        payload["totals"] = order_totals(order)
        payload["payments"] = [payment_dict(payment) for payment in payments]
        return Response(payload)


class QuotationView(RoleAPIView):
    authorization = "orders.manage"

    def post(self, request, order_id):
        serializer = QuotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = save_quotation(
            order_id=order_id,
            items=data["items"],
            delivery_date=data.get("deliveryDate"),
            notes=data.get("notes", ""),
            actor=request.user,
        )
        return Response(order_dict(order))


class TransitionView(RoleAPIView):
    authorization = "orders.manage"

    def post(self, request, order_id):
        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = transition_order(
            order_id=order_id,
            next_status=serializer.validated_data["status"],
            actor=request.user,
        )
        return Response(order_dict(order))


class CancelOrderView(RoleAPIView):
    authorization = "orders.manage"

    def post(self, request, order_id):
        order = cancel_order(order_id=order_id, actor=request.user)
        return Response(order_dict(order))


class PublicInquiryView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PublicWriteThrottle]

    def post(self, request):
        serializer = CustomInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = create_inquiry(
            contact=data["contact"],
            order_type=data["type"],
            description=data["description"],
            delivery_date=data.get("deliveryDate"),
            occasion=data.get("occasion", ""),
            servings=data.get("servings", ""),
            budget=data.get("budget", ""),
            notes=data.get("notes", ""),
        )
        return Response(order_dict(order), status=201)


class PosSaleView(RoleAPIView):
    authorization = "pos.use"

    def post(self, request):
        serializer = SaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        idempotency_key = (
            data.get("idempotencyKey")
            or request.headers.get("Idempotency-Key")
            or None
        )
        order, payment = create_sale(
            items=data["items"],
            location=data["location"],
            method=data["method"],
            customer_id=data.get("customerId"),
            actor=request.user,
            idempotency_key=idempotency_key,
        )
        payload = {"order": order_dict(order)}
        if payment:
            payload["payment"] = payment_dict(payment)
        return Response(payload, status=201)
