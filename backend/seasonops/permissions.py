from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission

from .models import Location, User


def _is_owner(user):
    return user.is_superuser or user.role == User.Role.OWNER


def _requested_location(user, request):
    location_id = request.query_params.get("location")
    if _is_owner(user):
        if not location_id:
            return None
        try:
            return Location.objects.get(pk=location_id)
        except (Location.DoesNotExist, ValueError):
            raise ValidationError({"location": "Choose a valid location."}) from None
    if user.location_id is None:
        raise PermissionDenied("This account is not assigned to a location.")
    if location_id and str(user.location_id) != location_id:
        raise PermissionDenied("You do not have access to that location.")
    return user.location


def _required_location(user, request):
    location = _requested_location(user, request)
    if location is None:
        raise ValidationError({"location": "Choose a location for this action."})
    if not location.is_active:
        raise ValidationError({"location": "This location is inactive."})
    return location


def _scoped(queryset, user, request, field="location"):
    location = _requested_location(user, request)
    if location is not None:
        return queryset.filter(**{field: location})
    return queryset


class HasBusinessPermission(BasePermission):
    message = "Your account is not permitted to use this workspace feature."

    def has_permission(self, request, view):
        required = getattr(view, "required_permission", None)
        any_required = getattr(view, "required_permissions_any", ())
        if any_required:
            return (
                request.user.is_authenticated
                and bool(set(any_required) & request.user.effective_business_permissions)
            )
        if required is None:
            return True
        user = request.user
        return (
            user.is_authenticated
            and required in user.effective_business_permissions
        )
