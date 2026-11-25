from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.audit.services import log_activity
from apps.core.errors import DomainError
from apps.core.services import require_non_empty
from apps.accounts.models import Role

User = get_user_model()


def _validate_password(password: str) -> None:
    try:
        validate_password(password)
    except ValidationError as exc:
        raise DomainError(" ".join(exc.messages))


def create_employee(*, name, email, password, role, actor) -> User:
    clean_name = require_non_empty(name, "Employee name is required.")
    clean_email = require_non_empty(email, "Email is required.").lower()
    if "@" not in clean_email:
        raise DomainError("Enter a valid email address.")
    if role not in dict(Role.choices):
        raise DomainError("Select a valid role.")
    if len((password or "").strip()) < 8:
        raise DomainError("Passwords must be at least 8 characters.")
    _validate_password(password)
    if User.objects.filter(email__iexact=clean_email).exists():
        raise DomainError("An account with this email already exists.")
    try:
        with transaction.atomic():
            employee = User.objects.create_user(
                email=clean_email,
                password=password,
                name=clean_name,
                role=role,
                is_active=True,
            )
    except IntegrityError:
        raise DomainError("An account with this email already exists.")
    log_activity(f"{employee.name} added as {employee.role}.", actor=actor)
    return employee


def update_employee(*, employee_id, actor, name=None, role=None, is_active=None) -> User:
    if str(actor.id) == str(employee_id) and is_active is False:
        raise DomainError("You cannot deactivate your own account.")
    employee = User.objects.filter(pk=employee_id).first()
    if employee is None:
        raise DomainError("Employee not found.")
    if name is not None:
        employee.name = require_non_empty(name, "Name is required.")
    if role is not None:
        if role not in dict(Role.choices):
            raise DomainError("Select a valid role.")
        employee.role = role
    if is_active is not None:
        employee.is_active = bool(is_active)
    employee.save()
    log_activity(f"{employee.name}'s account updated.", actor=actor)
    return employee
