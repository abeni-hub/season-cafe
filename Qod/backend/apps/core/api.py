from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import RolePermission
from .pagination import StandardPagination


class RoleAPIView(APIView):
    """Authenticated view whose access is declared with ``authorization``."""

    permission_classes = [IsAuthenticated, RolePermission]
    authorization = None

    def paginate(self, request, queryset, mapper):
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            return paginator.get_paginated_response([mapper(entry) for entry in page])
        return Response([mapper(entry) for entry in queryset])
