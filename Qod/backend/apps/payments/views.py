from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.serializers import payment_dict
from .models import Payment
from .serializers import PaymentCreateSerializer, RefundCreateSerializer
from .services import record_payment, record_refund


class PaymentListCreateView(RoleAPIView):
    authorization = "payments.view"

    def get(self, request):
        queryset = Payment.objects.select_related("order").all()
        order = request.query_params.get("order")
        if order:
            queryset = queryset.filter(order_id=order)
        customer = request.query_params.get("customer")
        if customer:
            queryset = queryset.filter(customer_id=customer)
        kind = request.query_params.get("kind")
        if kind:
            queryset = queryset.filter(kind=kind)
        return self.paginate(request, queryset.order_by("-created_at"), payment_dict)


class PaymentCreateView(RoleAPIView):
    authorization = "payments.manage"

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = record_payment(
            order_id=data["orderId"],
            amount_cents=data["amountCents"],
            method=data["method"],
            note=data.get("note", ""),
            location=data.get("location") or None,
            actor=request.user,
            idempotency_key=data.get("idempotencyKey")
            or request.headers.get("Idempotency-Key")
            or None,
        )
        return Response(payment_dict(payment), status=201)


class RefundCreateView(RoleAPIView):
    authorization = "payments.manage"

    def post(self, request):
        serializer = RefundCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = record_refund(
            order_id=data["orderId"],
            amount_cents=data["amountCents"],
            method=data["method"],
            note=data.get("note", ""),
            reason=data.get("reason", ""),
            location=data.get("location") or None,
            actor=request.user,
            idempotency_key=data.get("idempotencyKey")
            or request.headers.get("Idempotency-Key")
            or None,
        )
        return Response(payment_dict(payment), status=201)
