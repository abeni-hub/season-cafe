from rest_framework import serializers

from apps.core.constants import LOCATION_CHOICES
from .models import ExpenseCategory


class ExpenseCreateSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=ExpenseCategory.choices)
    amountCents = serializers.IntegerField(min_value=1)
    location = serializers.ChoiceField(choices=LOCATION_CHOICES)
    note = serializers.CharField(max_length=300)
    incurredAt = serializers.DateField()
