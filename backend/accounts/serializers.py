from rest_framework import serializers

from seasonops.models import Location


class CsrfTokenSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PortalLocationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.ChoiceField(choices=Location.Kind.choices)


class PortalUserSerializer(serializers.Serializer):
    authenticated = serializers.BooleanField(required=False)
    id = serializers.IntegerField(required=False)
    username = serializers.CharField(required=False)
    displayName = serializers.CharField(required=False)
    role = serializers.CharField(required=False)
    workspace = serializers.CharField(required=False)
    permissions = serializers.ListField(child=serializers.CharField(), required=False)
    canManageCatalog = serializers.BooleanField(required=False)
    location = PortalLocationSerializer(allow_null=True, required=False)
    csrfToken = serializers.CharField(required=False)
