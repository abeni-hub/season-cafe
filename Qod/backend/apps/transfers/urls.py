from django.urls import path

from .views import (
    TransferApproveView,
    TransferCancelView,
    TransferDetailView,
    TransferDispatchView,
    TransferListCreateView,
    TransferReceiveView,
)

urlpatterns = [
    path("transfers/", TransferListCreateView.as_view(), name="transfer-list"),
    path("transfers/<uuid:transfer_id>/", TransferDetailView.as_view(), name="transfer-detail"),
    path("transfers/<uuid:transfer_id>/approve/", TransferApproveView.as_view(), name="transfer-approve"),
    path("transfers/<uuid:transfer_id>/dispatch/", TransferDispatchView.as_view(), name="transfer-dispatch"),
    path("transfers/<uuid:transfer_id>/receive/", TransferReceiveView.as_view(), name="transfer-receive"),
    path("transfers/<uuid:transfer_id>/cancel/", TransferCancelView.as_view(), name="transfer-cancel"),
]
