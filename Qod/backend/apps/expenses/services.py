from datetime import date

from apps.audit.services import log_activity, actor_label
from apps.core.errors import DomainError
from apps.core.services import require_non_empty
from .models import Expense, ExpenseCategory


def record_expense(*, category, amount_cents, location, note, incurred_at, actor) -> Expense:
    if category not in dict(ExpenseCategory.choices):
        raise DomainError("Select a valid expense category.")
    if not isinstance(amount_cents, int) or amount_cents <= 0:
        raise DomainError("Expense amount must be greater than zero.")
    clean_note = require_non_empty(note, "Add a short note for the expense.")
    if not incurred_at:
        raise DomainError("Select the date the expense was incurred.")
    if isinstance(incurred_at, str):
        try:
            incurred_at = date.fromisoformat(incurred_at)
        except ValueError:
            raise DomainError("Select a valid expense date.")
    expense = Expense.objects.create(
        category=category,
        amount_cents=amount_cents,
        location=location,
        note=clean_note,
        incurred_at=incurred_at,
        recorded_by=actor if getattr(actor, "is_authenticated", False) else None,
        recorded_by_label=actor_label(actor),
    )
    log_activity(f"Expense recorded: {clean_note}.", actor=actor)
    return expense
