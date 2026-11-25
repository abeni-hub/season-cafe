from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from apps.audit.services import log_activity
from apps.core.constants import round_qty
from apps.core.errors import DomainError
from apps.core.services import next_code, require_non_empty
from apps.inventory.models import InventoryItem, ItemKind, MovementReason
from apps.inventory.services import add_movement, lock_items, total_stock
from apps.payments.services import valid_method
from apps.suppliers.models import Supplier
from .models import (
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    SupplierPayment,
)


def create_supplier(*, name, contact_name="", phone="", email="", notes="", actor=None) -> Supplier:
    supplier = Supplier.objects.create(
        name=require_non_empty(name, "Supplier name is required."),
        contact_name=(contact_name or "").strip(),
        phone=(phone or "").strip(),
        email=(email or "").strip().lower(),
        notes=(notes or "").strip(),
    )
    log_activity(f"Supplier {supplier.name} added.", actor=actor)
    return supplier


def create_purchase_order(
    *, supplier_id, lines, expected_at=None, notes="", actor
) -> PurchaseOrder:
    if not lines:
        raise DomainError("Add at least one purchase order line.")
    supplier = Supplier.objects.filter(pk=supplier_id).first()
    if supplier is None:
        raise DomainError("Select a valid supplier.")
    seen = set()
    prepared = []
    for index, line in enumerate(lines, start=1):
        item = InventoryItem.objects.filter(pk=line.get("itemId")).first()
        if item is None:
            raise DomainError(f"Line {index}: select a valid material.")
        if item.kind == ItemKind.FINISHED:
            raise DomainError("Finished goods are produced, not purchased.")
        if str(item.id) in seen:
            raise DomainError("Each material may only appear once on a purchase order.")
        seen.add(str(item.id))
        quantity = round_qty(line.get("quantity"))
        if quantity <= 0:
            raise DomainError(f"Line {index}: quantity must be greater than zero.")
        cost = line.get("unitCostCents")
        if not isinstance(cost, int) or cost < 0:
            raise DomainError(f"Line {index}: unit cost is invalid.")
        prepared.append((item, quantity, cost))

    with transaction.atomic():
        order = PurchaseOrder.objects.create(
            code=next_code("po"),
            supplier=supplier,
            expected_at=expected_at or None,
            notes=(notes or "").strip(),
            created_by=actor,
        )
        for item, quantity, cost in prepared:
            PurchaseOrderLine.objects.create(
                purchase_order=order,
                item=item,
                quantity=quantity,
                unit_cost_cents=cost,
            )
        log_activity(
            f"{order.code} raised with {supplier.name}. Ordered goods do not increase stock "
            "until received.",
            actor=actor,
        )
    return PurchaseOrder.objects.prefetch_related("lines").get(pk=order.pk)


def receive_purchase_order(*, po_id, location, lines, note="", actor) -> PurchaseReceipt:
    with transaction.atomic():
        try:
            order = (
                PurchaseOrder.objects.select_for_update()
                .prefetch_related("lines")
                .get(pk=po_id)
            )
        except PurchaseOrder.DoesNotExist:
            raise DomainError("Purchase order not found.")
        if order.status == PurchaseOrder.Status.RECEIVED:
            raise DomainError("This purchase order is already fully received.")
        if order.status == PurchaseOrder.Status.CANCELLED:
            raise DomainError("Cancelled purchase orders cannot be received.")

        previous = {}
        for receipt in order.receipts.prefetch_related("lines"):
            for line in receipt.lines.all():
                key = str(line.item_id)
                previous[key] = previous.get(key, Decimal("0")) + Decimal(line.quantity)

        po_lines = {str(line.item_id): line for line in order.lines.all()}
        prepared = []
        for line in lines:
            item_id = str(line.get("itemId"))
            po_line = po_lines.get(item_id)
            if po_line is None:
                item = InventoryItem.objects.filter(pk=item_id).first()
                name = item.name if item else "This item"
                raise DomainError(f"{name} is not on this purchase order.")
            quantity = round_qty(line.get("quantity"))
            if quantity < 0:
                raise DomainError("Received quantities cannot be negative.")
            if quantity == 0:
                continue
            remaining = Decimal(po_line.quantity) - previous.get(item_id, Decimal("0"))
            if quantity > remaining:
                raise DomainError(
                    f"Cannot receive {quantity} of {po_line.item.name}; only {remaining} remains "
                    f"on {order.code}."
                )
            prepared.append((po_line.item, quantity, po_line.unit_cost_cents))
        if not prepared:
            raise DomainError("Enter at least one quantity to receive.")

        locked = lock_items([item.id for item, _, _ in prepared])
        receipt = PurchaseReceipt.objects.create(
            purchase_order=order,
            supplier=order.supplier,
            location=location,
            received_by=actor if getattr(actor, "is_authenticated", False) else None,
            received_by_label=getattr(actor, "name", "System"),
            note=(note or "").strip(),
        )
        for item, quantity, unit_cost in prepared:
            item = locked[str(item.id)]
            existing_qty = total_stock(item.id)
            new_qty = existing_qty + quantity
            if new_qty > 0:
                weighted = (
                    existing_qty * item.cost_per_unit_cents + quantity * unit_cost
                ) / new_qty
                item.cost_per_unit_cents = int(
                    weighted.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                )
                item.save(update_fields=["cost_per_unit_cents", "updated_at"])
            PurchaseReceiptLine.objects.create(
                receipt=receipt,
                item=item,
                quantity=quantity,
                unit_cost_cents=unit_cost,
            )
            add_movement(
                item,
                location,
                quantity,
                MovementReason.PURCHASE_RECEIPT,
                ref_id=order.id,
                event_id=receipt.id,
                note=f"{order.code} receipt",
                actor=actor,
            )

        totals = dict(previous)
        for item, quantity, _ in prepared:
            key = str(item.id)
            totals[key] = totals.get(key, Decimal("0")) + quantity
        fully_received = all(
            totals.get(str(line.item_id), Decimal("0")) >= Decimal(line.quantity)
            for line in order.lines.all()
        )
        order.status = (
            PurchaseOrder.Status.RECEIVED
            if fully_received
            else PurchaseOrder.Status.PARTIALLY_RECEIVED
        )
        order.save(update_fields=["status", "updated_at"])
        log_activity(
            f"{len(prepared)} line(s) received against {order.code} at "
            f"{'Café' if location == 'cafe' else 'Home Bakery'}. Stock and weighted costs updated.",
            actor=actor,
        )
    return PurchaseReceipt.objects.prefetch_related("lines").get(pk=receipt.pk)


def cancel_purchase_order(*, po_id, actor) -> PurchaseOrder:
    with transaction.atomic():
        try:
            order = PurchaseOrder.objects.select_for_update().get(pk=po_id)
        except PurchaseOrder.DoesNotExist:
            raise DomainError("Purchase order not found.")
        if order.receipts.exists():
            raise DomainError("Purchase orders with receipts cannot be cancelled.")
        if order.status == PurchaseOrder.Status.CANCELLED:
            raise DomainError("This purchase order is already cancelled.")
        order.status = PurchaseOrder.Status.CANCELLED
        order.save(update_fields=["status", "updated_at"])
        log_activity(f"{order.code} cancelled.", actor=actor)
    return order


def record_supplier_payment(*, supplier_id, amount_cents, method, note="", actor) -> SupplierPayment:
    if not isinstance(amount_cents, int) or amount_cents <= 0:
        raise DomainError("Enter a payment amount greater than zero.")
    valid_method(method)
    supplier = Supplier.objects.filter(pk=supplier_id).first()
    if supplier is None:
        raise DomainError("Supplier not found.")
    payment = SupplierPayment.objects.create(
        supplier=supplier,
        amount_cents=amount_cents,
        method=method,
        note=(note or "").strip(),
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    log_activity(f"Supplier payment recorded for {supplier.name}.", actor=actor)
    return payment


def supplier_balances():
    suppliers = Supplier.objects.all().order_by("name")
    rows = []
    for supplier in suppliers:
        received = sum(
            (
                Decimal(line.quantity) * line.unit_cost_cents
                for receipt in supplier.receipts.prefetch_related("lines")
                for line in receipt.lines.all()
            ),
            Decimal("0"),
        )
        paid = sum((payment.amount_cents for payment in supplier.payments.all()), 0)
        received_cents = int(received)
        rows.append(
            {
                "supplierId": str(supplier.id),
                "supplier": supplier,
                "name": supplier.name,
                "receivedCents": received_cents,
                "paidCents": paid,
                "balanceCents": received_cents - paid,
            }
        )
    return rows
