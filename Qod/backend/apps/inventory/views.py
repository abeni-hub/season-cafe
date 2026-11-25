from django.db.models import Q
from rest_framework.response import Response

from apps.audit.services import log_activity
from apps.core.api import RoleAPIView
from apps.core.serializers import inventory_item_dict, movement_dict
from .models import InventoryItem, StockMovement
from .serializers import AdjustmentSerializer, InventoryItemCreateSerializer
from .services import adjust_stock, create_item, stock_positions


class InventoryItemListCreateView(RoleAPIView):
    authorization = "inventory.view"

    def get(self, request):
        queryset = InventoryItem.objects.all()
        kind = request.query_params.get("kind")
        if kind:
            queryset = queryset.filter(kind=kind)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(sku__icontains=search))
        ordering = {"raw": 0, "packaging": 1, "finished": 2}
        items = list(queryset)
        items.sort(key=lambda item: (ordering.get(item.kind, 9), item.name.lower()))
        return self.paginate(request, items, inventory_item_dict)


class InventoryItemCreateView(RoleAPIView):
    authorization = "inventory.manage"

    def post(self, request):
        serializer = InventoryItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        item = create_item(
            name=data["name"].strip(),
            kind=data["kind"],
            unit=data["unit"],
            cost_per_unit_cents=data["costPerUnitCents"],
            reorder_level=data["reorderLevel"],
            actor=request.user,
        )
        log_activity(f"Inventory material {item.name} added.", actor=request.user)
        return Response(inventory_item_dict(item), status=201)


class StockListView(RoleAPIView):
    authorization = ["inventory.view", "inventory.manage", "pos.use"]

    def get(self, request):
        positions = stock_positions()
        rows = []
        for item in InventoryItem.objects.all():
            by_location = {
                "home_bakery": float(positions.get((str(item.id), "home_bakery"), 0)),
                "cafe": float(positions.get((str(item.id), "cafe"), 0)),
            }
            total = by_location["home_bakery"] + by_location["cafe"]
            rows.append(
                {
                    "item": inventory_item_dict(item),
                    "byLocation": by_location,
                    "total": total,
                    "low": total < float(item.reorder_level),
                }
            )
        return self.paginate(request, rows, lambda row: row)


class MovementListView(RoleAPIView):
    authorization = "inventory.view"

    def get(self, request):
        queryset = StockMovement.objects.select_related("item").all()
        item = request.query_params.get("item")
        if item:
            queryset = queryset.filter(item_id=item)
        location = request.query_params.get("location")
        if location:
            queryset = queryset.filter(location=location)
        reason = request.query_params.get("reason")
        if reason:
            queryset = queryset.filter(reason=reason)
        return self.paginate(request, queryset.order_by("-created_at"), movement_dict)


class StockAdjustmentView(RoleAPIView):
    authorization = "inventory.manage"

    def post(self, request):
        serializer = AdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        movement = adjust_stock(
            item_id=data["itemId"],
            location=data["location"],
            mode=data["mode"],
            quantity=data["quantity"],
            note=data.get("note", ""),
            actor=request.user,
        )
        return Response(movement_dict(movement), status=201)
