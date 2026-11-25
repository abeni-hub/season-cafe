from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_POST
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from seasonops.models import User
from seasonops.services import log_activity
from seasonops.permissions import _is_owner

from .serializers import CsrfTokenSerializer, LoginRequestSerializer, PortalUserSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    permission_classes = []
    authentication_classes = []

    @extend_schema(responses=CsrfTokenSerializer)
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginRequestSerializer, responses=PortalUserSerializer)
    def post(self, request):
        payload = request.data
        if not isinstance(payload, dict):
            return Response({"detail": "Send a valid JSON object."}, status=status.HTTP_400_BAD_REQUEST)
        username = payload.get("username")
        password = payload.get("password")
        if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
            return Response(
                {"detail": "Enter your username and password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = authenticate(request._request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request._request, user)
        log_activity(
            location=user.location,
            actor=user,
            action="login",
            summary=f"{user.get_username()} signed in.",
            target_type="user",
            target_id=user.pk,
        )
        result = _user_payload(user)
        result["csrfToken"] = get_token(request._request)
        return Response(result)


@csrf_protect
@require_POST
def logout_view(request):
    actor = request.user if request.user.is_authenticated else None
    location = actor.location if actor else None
    logout(request)
    if actor is not None:
        log_activity(
            location=location,
            actor=actor,
            action="logout",
            summary=f"{actor.get_username()} signed out.",
            target_type="user",
            target_id=actor.pk,
        )
    return JsonResponse({"detail": "Signed out."})


def _user_payload(user):
    return {
        "id": user.pk,
        "username": user.get_username(),
        "displayName": user.get_full_name() or user.get_username(),
        "role": user.role,
        "workspace": user.workspace,
        "permissions": sorted(user.effective_business_permissions),
        "canManageCatalog": user.is_staff and _is_owner(user),
        "location": (
            {"id": user.location_id, "name": user.location.name}
            if user.location_id
            else None
        ),
    }


class MeView(APIView):
    permission_classes = []

    @extend_schema(responses=PortalUserSerializer)
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False})
        return Response(_user_payload(request.user))
