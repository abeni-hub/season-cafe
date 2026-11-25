from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.serializers import batch_dict
from .models import ProductionBatch
from .serializers import BatchCreateSerializer, BatchTransitionSerializer
from .services import advance_batch, create_batch, ingredient_availability


class BatchListCreateView(RoleAPIView):
    authorization = "production.view"

    def get(self, request):
        queryset = ProductionBatch.objects.select_related("product", "order", "recipe")
        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        order = request.query_params.get("order")
        if order:
            queryset = queryset.filter(order_id=order)
        product = request.query_params.get("product")
        if product:
            queryset = queryset.filter(product_id=product)
        return self.paginate(request, queryset.order_by("-created_at"), batch_dict)


class BatchCreateView(RoleAPIView):
    authorization = "production.manage"

    def post(self, request):
        serializer = BatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        batch = create_batch(
            title=data.get("title", ""),
            product_id=data.get("productId"),
            recipe_id=data.get("recipeId"),
            order_id=data.get("orderId"),
            quantity=data["quantity"],
            location=data["location"],
            scheduled_for=data.get("scheduledFor"),
            assigned_employee_id=data.get("assignedEmployeeId"),
            notes=data.get("notes", ""),
            actor=request.user,
        )
        return Response(batch_dict(batch), status=201)


class BatchDetailView(RoleAPIView):
    authorization = "production.view"

    def get(self, request, batch_id):
        batch = ProductionBatch.objects.filter(pk=batch_id).select_related(
            "product", "recipe", "order"
        ).first()
        if batch is None:
            raise DomainError("Production batch not found.")
        payload = batch_dict(batch)
        payload["ingredients"] = [
            {
                **row,
                "required": float(row["required"]),
                "available": float(row["available"]),
            }
            for row in ingredient_availability(batch)
        ]
        return Response(payload)


class BatchTransitionView(RoleAPIView):
    authorization = "production.manage"

    def post(self, request, batch_id):
        serializer = BatchTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = advance_batch(
            batch_id=batch_id,
            next_status=serializer.validated_data["status"],
            actor=request.user,
        )
        return Response(batch_dict(batch))
