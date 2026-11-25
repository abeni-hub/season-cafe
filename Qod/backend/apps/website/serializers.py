from rest_framework import serializers


class SiteContentUpdateSerializer(serializers.Serializer):
    heroEyebrow = serializers.CharField(required=False, allow_blank=True, max_length=120)
    heroTitle = serializers.CharField(required=False, allow_blank=True, max_length=160)
    heroLead = serializers.CharField(required=False, allow_blank=True)
    aboutTitle = serializers.CharField(required=False, allow_blank=True, max_length=160)
    aboutLead = serializers.CharField(required=False, allow_blank=True)
    aboutBody = serializers.CharField(required=False, allow_blank=True)
    customOrderNote = serializers.CharField(required=False, allow_blank=True)
    contactPhone = serializers.CharField(required=False, allow_blank=True, max_length=60)
    contactEmail = serializers.EmailField(required=False, allow_blank=True)
    contactAddress = serializers.CharField(required=False, allow_blank=True, max_length=300)
    openingHours = serializers.CharField(required=False, allow_blank=True, max_length=200)
    galleryCaptions = serializers.ListField(
        child=serializers.CharField(allow_blank=True, max_length=200), required=False
    )


class SettingsUpdateSerializer(serializers.Serializer):
    businessName = serializers.CharField(required=False, allow_blank=True, max_length=120)
    currency = serializers.CharField(required=False, allow_blank=True, max_length=3)
    tagline = serializers.CharField(required=False, allow_blank=True, max_length=160)


class PublicMessageCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)
    subject = serializers.CharField(max_length=200)
    body = serializers.CharField()
