from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.serializers import transfer_dict
from .models import Transfer
from .serializers import TransferCreateSerializer
from .services import (
    approve_transfer,
    cancel_transfer,
    create_transfer,
    dispatch_transfer,
    receive_transfer,
)


class TransferListCreateView(RoleAPIView):
    authorization = "transfers.manage"

    def get(self, request):
        queryset = Transfer.objects.prefetch_related("lines")
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return self.paginate(request, queryset.order_by("-created_at"), transfer_dict)

    def post(self, request):
        payload = request.data.copy()
        payload["from_location"] = request.data.get(
            "from", request.data.get("from_location", "")
        )
        payload["to_location"] = request.data.get(
            "to", request.data.get("to_location", "")
        )
        serializer = TransferCreateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        transfer = create_transfer(
            from_location=data["from_location"],
            to_location=data["to_location"],
            lines=data["lines"],
            notes=data.get("notes", ""),
            actor=request.user,
        )
        return Response(transfer_dict(transfer), status=201)


class TransferDetailView(RoleAPIView):
    authorization = "transfers.manage"

    def get(self, request, transfer_id):
        transfer = Transfer.objects.prefetch_related("lines").filter(pk=transfer_id).first()
        if transfer is None:
            raise DomainError("Transfer not found.")
        return Response(transfer_dict(transfer))


def _run_action(action, request, transfer_id):
    transfer = action(transfer_id=transfer_id, actor=request.user)
    return Response(transfer_dict(transfer))


class TransferApproveView(RoleAPIView):
    authorization = "transfers.manage"

    def post(self, request, transfer_id):
        return _run_action(approve_transfer, request, transfer_id)


class TransferDispatchView(RoleAPIView):
    authorization = "transfers.manage"

    def post(self, request, transfer_id):
        return _run_action(dispatch_transfer, request, transfer_id)


class TransferReceiveView(RoleAPIView):
    authorization = "transfers.manage"

    def post(self, request, transfer_id):
        return _run_action(receive_transfer, request, transfer_id)


class TransferCancelView(RoleAPIView):
    authorization = "transfers.manage"

    def post(self, request, transfer_id):
        return _run_action(cancel_transfer, request, transfer_id)
