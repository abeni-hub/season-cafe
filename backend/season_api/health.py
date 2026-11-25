import logging

from django.db import DatabaseError, connections
from django.http import JsonResponse
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)


@require_GET
def liveness(request):
    return JsonResponse({"status": "ok"})


@require_GET
def readiness(request):
    try:
        connections["default"].ensure_connection()
    except DatabaseError:
        logger.exception("Database readiness check failed.")
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ready"})
