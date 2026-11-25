from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES
from .models import ItemKind, Unit


class InventoryItemCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    kind = serializers.ChoiceField(choices=[ItemKind.RAW, ItemKind.PACKAGING])
    unit = serializers.ChoiceField(choices=Unit.choices)
    costPerUnitCents = serializers.IntegerField(min_value=0)
    reorderLevel = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class AdjustmentSerializer(serializers.Serializer):
    itemId = serializers.UUIDField()
    location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    mode = serializers.ChoiceField(choices=["add", "remove", "wastage"])
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=300)
