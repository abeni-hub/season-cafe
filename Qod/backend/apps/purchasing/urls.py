from django.urls import path

from .views import (
    PurchaseOrderCancelView,
    PurchaseOrderDetailView,
    PurchaseOrderListCreateView,
    PurchaseOrderReceiveView,
    PurchaseReceiptListView,
    SupplierBalanceListView,
    SupplierPaymentListCreateView,
)

urlpatterns = [
    path("purchase-orders/", PurchaseOrderListCreateView.as_view(), name="po-list"),
    path("purchase-orders/<uuid:po_id>/", PurchaseOrderDetailView.as_view(), name="po-detail"),
    path(
        "purchase-orders/<uuid:po_id>/receive/",
        PurchaseOrderReceiveView.as_view(),
        name="po-receive",
    ),
    path(
        "purchase-orders/<uuid:po_id>/cancel/",
        PurchaseOrderCancelView.as_view(),
        name="po-cancel",
    ),
    path("purchase-receipts/", PurchaseReceiptListView.as_view(), name="receipt-list"),
    path(
        "supplier-payments/",
        SupplierPaymentListCreateView.as_view(),
        name="supplier-payment-list",
    ),
    path("supplier-balances/", SupplierBalanceListView.as_view(), name="supplier-balances"),
]
