from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.models import BusinessSettings
from apps.core.serializers import message_dict, product_dict, settings_dict, site_content_dict
from apps.core.throttles import PublicWriteThrottle
from apps.products.models import Product
from .models import Message, SiteContent
from .serializers import (
    PublicMessageCreateSerializer,
    SettingsUpdateSerializer,
    SiteContentUpdateSerializer,
)
from .services import mark_message_read, submit_message, update_settings, update_site_content


class PublicSiteView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "siteContent": site_content_dict(SiteContent.load()),
                "settings": settings_dict(BusinessSettings.load()),
                "products": [
                    product_dict(product)
                    for product in Product.objects.filter(is_published=True).order_by("sort_order")
                ],
            }
        )


class SiteContentView(RoleAPIView):
    authorization = "cms.manage"

    def get(self, request):
        return Response(site_content_dict(SiteContent.load()))

    def patch(self, request):
        serializer = SiteContentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = update_site_content(patch=serializer.validated_data, actor=request.user)
        return Response(site_content_dict(content))


class SettingsView(RoleAPIView):
    authorization = "cms.manage"

    def get(self, request):
        return Response(settings_dict(BusinessSettings.load()))

    def patch(self, request):
        serializer = SettingsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settings = update_settings(patch=serializer.validated_data, actor=request.user)
        return Response(settings_dict(settings))


class MessageListCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PublicWriteThrottle]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=401)
        from apps.accounts.permissions import has_permission

        if not has_permission(request.user, "cms.manage"):
            return Response({"detail": "Your role does not allow this action."}, status=403)
        return Response([message_dict(message) for message in Message.objects.order_by("-created_at")])

    def post(self, request):
        serializer = PublicMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        message = submit_message(
            name=data["name"],
            subject=data["subject"],
            body=data["body"],
            email=data.get("email", ""),
            phone=data.get("phone", ""),
        )
        return Response(message_dict(message), status=201)


class MessageReadView(RoleAPIView):
    authorization = "cms.manage"

    def post(self, request, message_id):
        message = mark_message_read(message_id=message_id, actor=request.user)
        return Response(message_dict(message))
