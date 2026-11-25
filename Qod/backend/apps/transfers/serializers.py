from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES


class TransferLineSerializer(serializers.Serializer):
    itemId = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class TransferCreateSerializer(serializers.Serializer):
    from_location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    to_location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    lines = TransferLineSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)
