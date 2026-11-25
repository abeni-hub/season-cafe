from rest_framework import serializers

from .models import CustomerKind


class CustomerWriteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=CustomerKind.choices, default=CustomerKind.INDIVIDUAL)
    name = serializers.CharField(max_length=160)
    organization = serializers.CharField(max_length=160, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(max_length=300, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
