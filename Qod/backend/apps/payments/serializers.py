from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES, PAYMENT_METHOD_CHOICES


class PaymentCreateSerializer(serializers.Serializer):
    orderId = serializers.UUIDField()
    amountCents = serializers.IntegerField(min_value=1)
    method = serializers.ChoiceField(choices=PAYMENT_METHOD_CHOICES)
    note = serializers.CharField(required=False, allow_blank=True, max_length=300)
    location = serializers.ChoiceField(choices=LOCATION_CHOICES, required=False, allow_blank=True)
    idempotencyKey = serializers.CharField(required=False, allow_blank=True, max_length=100)


class RefundCreateSerializer(PaymentCreateSerializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=300)
