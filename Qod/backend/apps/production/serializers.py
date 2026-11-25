from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES
from .models import BatchStatus


class BatchCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=160, required=False, allow_blank=True)
    productId = serializers.UUIDField(required=False, allow_null=True)
    recipeId = serializers.UUIDField(required=False, allow_null=True)
    orderId = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    scheduledFor = serializers.DateTimeField(required=False, allow_null=True)
    assignedEmployeeId = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class BatchTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=BatchStatus.choices)
