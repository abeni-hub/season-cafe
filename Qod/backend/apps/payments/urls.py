from django.urls import path

from .views import PaymentCreateView, PaymentListCreateView, RefundCreateView

urlpatterns = [
    path("payments/", PaymentListCreateView.as_view(), name="payment-list"),
    path("payments/record/", PaymentCreateView.as_view(), name="payment-create"),
    path("payments/refund/", RefundCreateView.as_view(), name="payment-refund"),
]
