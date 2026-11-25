from django.db import transaction
from django.utils import timezone

from apps.audit.services import log_activity
from .errors import DomainError
from .models import BusinessSettings, CodeSequence

CODE_STARTS = {
    "pos": 1000,
    "order": 2000,
    "inquiry": 3000,
    "po": 5000,
    "transfer": 6000,
    "batch": 7000,
}
CODE_PREFIXES = {
    "pos": "POS",
    "order": "ORD",
    "inquiry": "INQ",
    "po": "PO",
    "transfer": "TRF",
    "batch": "BATCH",
}


def next_sequence(key: str, prefix: str, start: int = 0, pad: int = 3) -> str:
    """Atomically reserve the next human-readable sequence value."""
    with transaction.atomic():
        sequence, _ = CodeSequence.objects.select_for_update().get_or_create(
            key=key, defaults={"value": start}
        )
        sequence.value += 1
        sequence.save(update_fields=["value"])
    return f"{prefix}-{str(sequence.value).zfill(pad)}"


def next_code(key: str, pad: int = 4) -> str:
    """Atomically reserve the next document code. Call inside an atomic block."""
    return next_sequence(key, CODE_PREFIXES[key], start=CODE_STARTS[key], pad=pad)


def get_settings() -> BusinessSettings:
    return BusinessSettings.load()


def require_non_empty(value, message: str) -> str:
    if value is None:
        raise DomainError(message)
    text = str(value).strip()
    if not text:
        raise DomainError(message)
    return text


def require_positive(value, message: str) -> None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise DomainError(message)
    if number <= 0:
        raise DomainError(message)


def activity(message: str, actor=None) -> None:
    log_activity(message=message, actor=actor, created_at=timezone.now())
