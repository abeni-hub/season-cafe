from rest_framework import serializers


class RecipeLineSerializer(serializers.Serializer):
    itemId = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class RecipeUpsertSerializer(serializers.Serializer):
    productId = serializers.UUIDField()
    yieldQuantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    lines = RecipeLineSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)
