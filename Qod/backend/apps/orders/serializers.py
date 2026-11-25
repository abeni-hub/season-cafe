from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES, PAYMENT_METHOD_CHOICES
from .models import OrderStatus, OrderType


class OrderLineInputSerializer(serializers.Serializer):
    productId = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField(max_length=300)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    unitPriceCents = serializers.IntegerField(min_value=0)


class ContactSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    kind = serializers.ChoiceField(choices=["individual", "organization"], default="individual")
    organization = serializers.CharField(max_length=160, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)


class CustomInquirySerializer(serializers.Serializer):
    contact = ContactSerializer()
    type = serializers.ChoiceField(
        choices=[OrderType.CUSTOM, OrderType.ORGANIZATIONAL, OrderType.BULK], default=OrderType.CUSTOM
    )
    description = serializers.CharField()
    deliveryDate = serializers.DateField(required=False, allow_null=True)
    occasion = serializers.CharField(required=False, allow_blank=True)
    servings = serializers.CharField(required=False, allow_blank=True)
    budget = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class OrderCreateSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=OrderType.choices, default=OrderType.CUSTOM)
    customerId = serializers.UUIDField()
    items = OrderLineInputSerializer(many=True)
    location = serializers.ChoiceField(choices=LOCATION_CHOICES, default="home_bakery")
    deliveryLocation = serializers.ChoiceField(
        choices=LOCATION_CHOICES, required=False, allow_blank=True
    )
    deliveryDate = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=[OrderStatus.QUOTED, OrderStatus.CONFIRMED], default=OrderStatus.QUOTED
    )


class QuotationSerializer(serializers.Serializer):
    items = OrderLineInputSerializer(many=True)
    deliveryDate = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class TransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)


class SaleLineSerializer(serializers.Serializer):
    productId = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class SaleSerializer(serializers.Serializer):
    customerId = serializers.UUIDField(required=False, allow_null=True)
    location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    method = serializers.ChoiceField(choices=PAYMENT_METHOD_CHOICES)
    items = SaleLineSerializer(many=True)
    idempotencyKey = serializers.CharField(required=False, allow_blank=True, max_length=100)
