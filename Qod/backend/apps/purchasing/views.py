from django.db.models import Q
from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.serializers import (
    purchase_order_dict,
    purchase_receipt_dict,
    supplier_payment_dict,
)
from .models import PurchaseOrder, PurchaseReceipt, SupplierPayment
from .serializers import (
    PurchaseOrderCreateSerializer,
    ReceiveSerializer,
    SupplierPaymentCreateSerializer,
)
from .services import (
    cancel_purchase_order,
    create_purchase_order,
    receive_purchase_order,
    record_supplier_payment,
    supplier_balances,
)


class PurchaseOrderListCreateView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request):
        queryset = PurchaseOrder.objects.prefetch_related("lines").select_related("supplier")
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        supplier = request.query_params.get("supplier")
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search) | Q(supplier__name__icontains=search)
            )
        return self.paginate(request, queryset.order_by("-created_at"), purchase_order_dict)

    def post(self, request):
        serializer = PurchaseOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = create_purchase_order(
            supplier_id=data["supplierId"],
            lines=data["lines"],
            expected_at=data.get("expectedAt"),
            notes=data.get("notes", ""),
            actor=request.user,
        )
        return Response(purchase_order_dict(order), status=201)


class PurchaseOrderDetailView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request, po_id):
        order = (
            PurchaseOrder.objects.prefetch_related("lines").filter(pk=po_id).first()
        )
        if order is None:
            raise DomainError("Purchase order not found.")
        payload = purchase_order_dict(order)
        payload["receipts"] = [
            purchase_receipt_dict(receipt)
            for receipt in order.receipts.prefetch_related("lines").order_by("-received_at")
        ]
        return Response(payload)


class PurchaseOrderReceiveView(RoleAPIView):
    authorization = "purchasing.manage"

    def post(self, request, po_id):
        serializer = ReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        receipt = receive_purchase_order(
            po_id=po_id,
            location=data["location"],
            lines=data["lines"],
            note=data.get("note", ""),
            actor=request.user,
        )
        return Response(purchase_receipt_dict(receipt), status=201)


class PurchaseOrderCancelView(RoleAPIView):
    authorization = "purchasing.manage"

    def post(self, request, po_id):
        order = cancel_purchase_order(po_id=po_id, actor=request.user)
        return Response(purchase_order_dict(order))


class PurchaseReceiptListView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request):
        queryset = PurchaseReceipt.objects.prefetch_related("lines").all()
        supplier = request.query_params.get("supplier")
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        return self.paginate(request, queryset.order_by("-received_at"), purchase_receipt_dict)


class SupplierPaymentListCreateView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request):
        queryset = SupplierPayment.objects.all()
        supplier = request.query_params.get("supplier")
        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        return self.paginate(request, queryset.order_by("-created_at"), supplier_payment_dict)

    def post(self, request):
        serializer = SupplierPaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = record_supplier_payment(
            supplier_id=data["supplierId"],
            amount_cents=data["amountCents"],
            method=data["method"],
            note=data.get("note", ""),
            actor=request.user,
        )
        return Response(supplier_payment_dict(payment), status=201)


class SupplierBalanceListView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request):
        rows = [
            {
                "supplierId": row["supplierId"],
                "name": row["name"],
                "receivedCents": row["receivedCents"],
                "paidCents": row["paidCents"],
                "balanceCents": row["balanceCents"],
            }
            for row in supplier_balances()
            if row["balanceCents"] != 0
        ]
        return Response(rows)
