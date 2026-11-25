from rest_framework import serializers


class ProductUpdateSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=False)
    tagline = serializers.CharField(required=False, allow_blank=False, max_length=200)
    priceCents = serializers.IntegerField(required=False, min_value=1)
    isPublished = serializers.BooleanField(required=False)
    isAvailable = serializers.BooleanField(required=False)
