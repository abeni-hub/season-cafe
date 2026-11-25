from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from .snapshot import build_snapshot


class BootstrapView(APIView):
    """Single call hydration endpoint for the React store (public-safe subset)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(build_snapshot(request.user))


class HealthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        payload = {
            "status": "ok",
            "service": "seasons-cake-api",
            "version": settings.API_VERSION,
            "environment": settings.APP_ENV,
            "timestamp": timezone.now().isoformat(),
        }
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            payload["database"] = "ok"
        except Exception:
            payload["status"] = "degraded"
            payload["database"] = "unavailable"
            return Response(payload, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(payload)
