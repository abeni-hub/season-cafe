from django.urls import path

from .views import (
    InventoryItemCreateView,
    InventoryItemListCreateView,
    MovementListView,
    StockAdjustmentView,
    StockListView,
)

urlpatterns = [
    path("inventory/items/", InventoryItemListCreateView.as_view(), name="inventory-items"),
    path("inventory/items/create/", InventoryItemCreateView.as_view(), name="inventory-item-create"),
    path("inventory/stock/", StockListView.as_view(), name="inventory-stock"),
    path("inventory/movements/", MovementListView.as_view(), name="inventory-movements"),
    path("inventory/adjustments/", StockAdjustmentView.as_view(), name="inventory-adjust"),
]
