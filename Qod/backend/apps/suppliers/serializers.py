from rest_framework import serializers


class SupplierCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    contactName = serializers.CharField(max_length=120, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
