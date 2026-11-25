from decimal import Decimal, ROUND_HALF_UP

from django.db import IntegrityError, transaction
from django.db.models import Sum

from apps.audit.services import log_activity
from apps.core.constants import PAYMENT_METHOD_CHOICES
from apps.core.errors import DomainError
from .models import Payment, PaymentKind, PaymentRole


def order_total_cents(order) -> int:
    total = Decimal("0")
    for line in order.items.all():
        total += Decimal(line.quantity) * Decimal(line.unit_price_cents)
    return int(total.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def order_totals(order) -> dict:
    payments = Payment.objects.filter(order=order)
    paid = (
        payments.filter(kind=PaymentKind.PAYMENT).aggregate(total=Sum("amount_cents"))["total"] or 0
    )
    refunded = (
        payments.filter(kind=PaymentKind.REFUND).aggregate(total=Sum("amount_cents"))["total"] or 0
    )
    total = order_total_cents(order)
    return {
        "totalCents": total,
        "paidCents": paid,
        "refundedCents": refunded,
        "balanceCents": total - (paid - refunded),
    }


def valid_method(method: str) -> str:
    if method not in dict(PAYMENT_METHOD_CHOICES):
        raise DomainError("Select a valid payment method.")
    return method


def record_payment(
    *,
    order_id,
    amount_cents: int,
    method: str,
    note: str = "",
    location: str | None = None,
    actor=None,
    idempotency_key: str | None = None,
    kind: str = PaymentKind.PAYMENT,
    reason: str = "",
) -> Payment:
    from apps.orders.models import Order, OrderStatus

    if not isinstance(amount_cents, int) or amount_cents <= 0:
        raise DomainError("Enter an amount greater than zero.")
    valid_method(method)
    note = (note or reason or "").strip()

    if idempotency_key:
        existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    try:
        with transaction.atomic():
            if idempotency_key:
                existing = (
                    Payment.objects.select_for_update()
                    .filter(idempotency_key=idempotency_key)
                    .first()
                )
                if existing:
                    return existing
            try:
                order = Order.objects.select_for_update().get(pk=order_id)
            except Order.DoesNotExist:
                raise DomainError("Order not found.")
            if order.status == OrderStatus.CANCELLED:
                raise DomainError("Payments cannot be recorded on a cancelled order.")

            totals = order_totals(order)
            if totals["totalCents"] <= 0:
                raise DomainError("Prepare a quotation before recording payments.")

            if kind == PaymentKind.PAYMENT:
                if totals["balanceCents"] <= 0:
                    raise DomainError("This order is already fully paid.")
                if amount_cents > totals["balanceCents"]:
                    raise DomainError("The payment cannot exceed the outstanding balance.")
                net_paid = totals["paidCents"] - totals["refundedCents"]
                if net_paid <= 0:
                    role = PaymentRole.DEPOSIT
                elif amount_cents >= totals["balanceCents"]:
                    role = PaymentRole.FINAL
                else:
                    role = PaymentRole.PARTIAL
                message = "Deposit recorded" if role == PaymentRole.DEPOSIT else "Payment recorded"
            else:
                net_paid = totals["paidCents"] - totals["refundedCents"]
                if net_paid <= 0:
                    raise DomainError("There are no payments to refund.")
                if amount_cents > net_paid:
                    raise DomainError("The refund cannot exceed the net amount paid on this order.")
                role = PaymentRole.REFUND
                message = "Refund recorded"

            payment = Payment.objects.create(
                order=order,
                customer=order.customer,
                kind=kind,
                role=role,
                method=method,
                amount_cents=amount_cents,
                location=location or order.location,
                note=note,
                created_by=actor if getattr(actor, "is_authenticated", False) else None,
                idempotency_key=idempotency_key,
            )
            log_activity(
                f"{message} on {order.code}. Financial event only — no stock movement.",
                actor=actor,
            )
            return payment
    except IntegrityError:
        if idempotency_key:
            existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return existing
        raise DomainError("The payment could not be recorded. Please retry.")


def record_refund(
    *,
    order_id,
    amount_cents: int,
    method: str,
    note: str = "",
    reason: str = "",
    location: str | None = None,
    actor=None,
    idempotency_key: str | None = None,
) -> Payment:
    return record_payment(
        order_id=order_id,
        amount_cents=amount_cents,
        method=method,
        note=note,
        reason=reason,
        location=location,
        actor=actor,
        idempotency_key=idempotency_key,
        kind=PaymentKind.REFUND,
    )
