from rest_framework import serializers

from .models import Role


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class EmployeeCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False)
    role = serializers.ChoiceField(choices=Role.choices)


class EmployeeUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    role = serializers.ChoiceField(choices=Role.choices, required=False)
    isActive = serializers.BooleanField(required=False)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
