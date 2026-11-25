from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.audit.services import log_activity
from apps.core.errors import DomainError
from apps.core.serializers import user_dict
from .serializers import LoginSerializer, LogoutSerializer


class LoginThrottle(SimpleRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        email = ""
        if hasattr(request, "data") and isinstance(request.data, dict):
            email = str(request.data.get("email", "")).strip().lower()
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{self.get_ident(request)}:{email}",
        }


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = authenticate(
            request=request, email=email, password=serializer.validated_data["password"]
        )
        if user is None or not user.is_active:
            raise DomainError("Incorrect email or password.")
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        refresh = RefreshToken.for_user(user)
        log_activity(f"{user.name} signed in.", actor=user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": user_dict(user),
            }
        )


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            # Logging out is idempotent from the client's perspective; the local
            # tokens are discarded even if the refresh token already expired.
            pass
        log_activity(f"{request.user.name} signed out.", actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(user_dict(request.user))
