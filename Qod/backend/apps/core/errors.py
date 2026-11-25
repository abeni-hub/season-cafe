from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


class DomainError(APIException):
    """Business-rule violation. Always surfaces as HTTP 400 with a readable detail."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "business_rule"
    default_detail = "This action is not allowed."


def _flatten_detail(data) -> str | None:
    if isinstance(data, str):
        return data
    if isinstance(data, list):
        for entry in data:
            message = _flatten_detail(entry)
            if message:
                return message
        return None
    if isinstance(data, dict):
        for key, value in data.items():
            if key in {"detail", "non_field_errors"}:
                message = _flatten_detail(value)
                if message:
                    return message
        for value in data.values():
            message = _flatten_detail(value)
            if message:
                return message
    return None


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(exc, ValidationError) and isinstance(data, dict):
        data.setdefault("errors", data.copy())
        detail = _flatten_detail(data)
        if detail:
            data["detail"] = detail
    elif isinstance(data, dict) and "detail" not in data:
        detail = _flatten_detail(data)
        if detail:
            data = {"detail": detail, **data}
            response.data = data
    elif isinstance(data, list) and not isinstance(data, dict):
        response.data = {"detail": _flatten_detail(data) or "Request failed.", "errors": data}
    return response
