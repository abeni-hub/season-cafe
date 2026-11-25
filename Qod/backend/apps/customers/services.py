from django.db import IntegrityError, transaction
from django.db.models import Q

from apps.core.errors import DomainError
from apps.core.services import require_non_empty
from .models import Customer


def list_customers():
    return Customer.objects.filter(is_walkin=False).order_by("name")


def get_walkin() -> Customer:
    customer = Customer.objects.filter(is_walkin=True).first()
    if customer:
        return customer
    return Customer.objects.create(
        kind="individual",
        name="Walk-in customer",
        is_walkin=True,
        notes="Default counter customer.",
    )


def find_customer_match(*, kind, name, organization="", email="", phone=""):
    email = (email or "").strip().lower()
    phone = (phone or "").strip()
    query = Customer.objects.filter(is_walkin=False)
    conditions = Q()
    if email:
        conditions |= Q(email__iexact=email)
    if phone:
        conditions |= Q(phone=phone)
    if conditions:
        match = query.filter(conditions).first()
        if match:
            return match
    return query.filter(
        kind=kind,
        name__iexact=name.strip(),
        organization=(organization or "").strip(),
    ).first()


def find_or_create_customer(
    *, kind, name, organization="", email="", phone="", address="", notes="", actor=None
) -> Customer:
    clean_name = require_non_empty(name, "Customer name is required.")
    match = find_customer_match(
        kind=kind, name=clean_name, organization=organization, email=email, phone=phone
    )
    if match:
        return match
    return create_customer(
        kind=kind,
        name=clean_name,
        organization=organization,
        email=email,
        phone=phone,
        address=address,
        notes=notes,
        actor=actor,
    )


def create_customer(
    *, kind, name, organization="", email="", phone="", address="", notes="", actor=None
) -> Customer:
    clean_name = require_non_empty(name, "Customer name is required.")
    try:
        with transaction.atomic():
            customer = Customer.objects.create(
                kind=kind,
                name=clean_name,
                organization=(organization or "").strip(),
                email=(email or "").strip().lower(),
                phone=(phone or "").strip(),
                address=(address or "").strip(),
                notes=(notes or "").strip(),
            )
    except IntegrityError:
        raise DomainError("A customer with this email already exists.")
    from apps.audit.services import log_activity

    log_activity(f"Customer {customer.name} added.", actor=actor or "System")
    return customer


def update_customer(customer: Customer, *, kind, name, organization="", email="", phone="", address="", notes="") -> Customer:
    customer.kind = kind
    customer.name = require_non_empty(name, "Customer name is required.")
    customer.organization = (organization or "").strip()
    customer.email = (email or "").strip().lower()
    customer.phone = (phone or "").strip()
    customer.address = (address or "").strip()
    customer.notes = (notes or "").strip()
    try:
        customer.save()
    except IntegrityError:
        raise DomainError("A customer with this email already exists.")
    return customer
