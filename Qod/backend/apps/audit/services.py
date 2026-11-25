from django.utils import timezone

from .models import Activity


def actor_label(actor) -> str:
    if actor is None:
        return "System"
    if isinstance(actor, str):
        return actor
    if getattr(actor, "is_authenticated", False):
        return getattr(actor, "name", None) or getattr(actor, "email", "Unknown user")
    return "System"


def log_activity(message: str, actor=None, created_at=None) -> Activity:
    return Activity.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        actor_label=actor_label(actor),
        message=message,
        created_at=created_at or timezone.now(),
    )
