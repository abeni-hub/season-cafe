from django.db import transaction
from django.utils import timezone

from apps.audit.services import log_activity
from apps.core.constants import round_qty
from apps.core.errors import DomainError
from apps.core.services import next_code
from apps.inventory.models import InventoryItem, MovementReason, StockMovement
from apps.inventory.services import add_movement, lock_items, require_stock
from .models import Transfer, TransferLine


def create_transfer(*, from_location, to_location, lines, notes="", actor) -> Transfer:
    if from_location == to_location:
        raise DomainError("Source and destination must differ.")
    prepared = []
    seen = set()
    for line in lines:
        quantity = round_qty(line.get("quantity"))
        if quantity <= 0:
            continue
        item = InventoryItem.objects.filter(pk=line.get("itemId")).first()
        if item is None:
            raise DomainError("A transfer line references an unknown item.")
        if str(item.id) in seen:
            raise DomainError("Each item may only appear once per transfer.")
        seen.add(str(item.id))
        prepared.append((item, quantity))
    if not prepared:
        raise DomainError("Add at least one transfer line.")

    with transaction.atomic():
        transfer = Transfer.objects.create(
            code=next_code("transfer"),
            from_location=from_location,
            to_location=to_location,
            status="requested",
            notes=(notes or "").strip(),
            created_by=actor,
        )
        for item, quantity in prepared:
            TransferLine.objects.create(transfer=transfer, item=item, quantity=quantity)
        log_activity(
            f"{transfer.code} requested "
            f"({'Café' if from_location == 'cafe' else 'Home Bakery'} → "
            f"{'Café' if to_location == 'cafe' else 'Home Bakery'}).",
            actor=actor,
        )
    return Transfer.objects.prefetch_related("lines").get(pk=transfer.pk)


def _set_status(*, transfer_id, next_status: str, action_label: str, actor) -> Transfer:
    with transaction.atomic():
        try:
            transfer = (
                Transfer.objects.select_for_update()
                .prefetch_related("lines__item")
                .get(pk=transfer_id)
            )
        except Transfer.DoesNotExist:
            raise DomainError("Transfer not found.")

        if next_status == "approved" and transfer.status != "requested":
            raise DomainError("Only requested transfers can be approved.")
        if next_status == "dispatched":
            if transfer.status != "approved":
                raise DomainError("Approve the transfer before dispatching.")
            if StockMovement.objects.filter(
                ref_id=transfer.id, reason=MovementReason.TRANSFER_OUT
            ).exists():
                raise DomainError("This transfer has already been dispatched.")
            lines = list(transfer.lines.all())
            locked = lock_items([line.item_id for line in lines])
            for line in lines:
                require_stock(
                    locked[str(line.item_id)], transfer.from_location, line.quantity, line.item.name
                )
            for line in lines:
                add_movement(
                    locked[str(line.item_id)],
                    transfer.from_location,
                    -line.quantity,
                    MovementReason.TRANSFER_OUT,
                    ref_id=transfer.id,
                    note=f"{transfer.code} dispatched",
                    actor=actor,
                )
            transfer.dispatched_at = timezone.now()
        if next_status == "received":
            if transfer.status != "dispatched":
                raise DomainError("Only dispatched transfers can be received.")
            if StockMovement.objects.filter(
                ref_id=transfer.id, reason=MovementReason.TRANSFER_IN
            ).exists():
                raise DomainError("This transfer has already been received.")
            lines = list(transfer.lines.all())
            locked = lock_items([line.item_id for line in lines])
            for line in lines:
                add_movement(
                    locked[str(line.item_id)],
                    transfer.to_location,
                    line.quantity,
                    MovementReason.TRANSFER_IN,
                    ref_id=transfer.id,
                    note=f"{transfer.code} received",
                    actor=actor,
                )
            transfer.received_at = timezone.now()
        if next_status == "cancelled":
            if transfer.status not in {"requested", "approved"}:
                raise DomainError("Only transfers that have not been dispatched can be cancelled.")

        transfer.status = next_status
        transfer.save(update_fields=["status", "dispatched_at", "received_at", "updated_at"])
        log_activity(f"{transfer.code} {action_label}.", actor=actor)
    return Transfer.objects.prefetch_related("lines").get(pk=transfer.pk)


def approve_transfer(*, transfer_id, actor) -> Transfer:
    return _set_status(
        transfer_id=transfer_id, next_status="approved", action_label="approved", actor=actor
    )


def dispatch_transfer(*, transfer_id, actor) -> Transfer:
    return _set_status(
        transfer_id=transfer_id,
        next_status="dispatched",
        action_label="dispatched — stock moved out once",
        actor=actor,
    )


def receive_transfer(*, transfer_id, actor) -> Transfer:
    return _set_status(
        transfer_id=transfer_id,
        next_status="received",
        action_label="received — stock moved in once",
        actor=actor,
    )


def cancel_transfer(*, transfer_id, actor) -> Transfer:
    return _set_status(
        transfer_id=transfer_id,
        next_status="cancelled",
        action_label="cancelled",
        actor=actor,
    )
