from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES, PAYMENT_METHOD_CHOICES


class PurchaseLineSerializer(serializers.Serializer):
    itemId = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    unitCostCents = serializers.IntegerField(min_value=0)


class PurchaseOrderCreateSerializer(serializers.Serializer):
    supplierId = serializers.UUIDField()
    lines = PurchaseLineSerializer(many=True)
    expectedAt = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class ReceiveLineSerializer(serializers.Serializer):
    itemId = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)


class ReceiveSerializer(serializers.Serializer):
    location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    lines = ReceiveLineSerializer(many=True)
    note = serializers.CharField(required=False, allow_blank=True)


class SupplierPaymentCreateSerializer(serializers.Serializer):
    supplierId = serializers.UUIDField()
    amountCents = serializers.IntegerField(min_value=1)
    method = serializers.ChoiceField(choices=PAYMENT_METHOD_CHOICES)
    note = serializers.CharField(required=False, allow_blank=True)
