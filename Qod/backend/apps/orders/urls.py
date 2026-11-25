from django.urls import path

from .views import (
    CancelOrderView,
    OrderCreateView,
    OrderDetailView,
    OrderListCreateView,
    PosSaleView,
    PublicInquiryView,
    QuotationView,
    TransitionView,
)

urlpatterns = [
    path("orders/", OrderListCreateView.as_view(), name="order-list"),
    path("orders/create/", OrderCreateView.as_view(), name="order-create"),
    path("orders/inquiries/", PublicInquiryView.as_view(), name="order-inquiry"),
    path("orders/<uuid:order_id>/", OrderDetailView.as_view(), name="order-detail"),
    path("orders/<uuid:order_id>/quotation/", QuotationView.as_view(), name="order-quotation"),
    path("orders/<uuid:order_id>/transition/", TransitionView.as_view(), name="order-transition"),
    path("orders/<uuid:order_id>/cancel/", CancelOrderView.as_view(), name="order-cancel"),
    path("pos/sales/", PosSaleView.as_view(), name="pos-sale"),
]
