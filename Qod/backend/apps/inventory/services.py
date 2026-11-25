from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from apps.audit.services import actor_label
from apps.core.constants import round_qty
from apps.core.errors import DomainError
from apps.core.services import next_sequence
from apps.products.models import Product
from .models import InventoryItem, ItemKind, StockMovement


def format_qty(value) -> str:
    text = f"{round_qty(value):.3f}".rstrip("0").rstrip(".")
    return text or "0"


def stock_qty(item_id, location: str) -> Decimal:
    total = StockMovement.objects.filter(item_id=item_id, location=location).aggregate(
        total=Sum("quantity_delta")
    )["total"]
    return round_qty(total or 0)


def total_stock(item_id) -> Decimal:
    total = StockMovement.objects.filter(item_id=item_id).aggregate(total=Sum("quantity_delta"))[
        "total"
    ]
    return round_qty(total or 0)


def stock_positions() -> dict[tuple[str, str], Decimal]:
    rows = (
        StockMovement.objects.values("item_id", "location")
        .annotate(total=Sum("quantity_delta"))
        .order_by()
    )
    return {(str(row["item_id"]), row["location"]): round_qty(row["total"]) for row in rows}


def lock_items(item_ids) -> dict[str, InventoryItem]:
    """Lock inventory rows in a stable order to serialise stock mutations."""
    ids = sorted({str(entry) for entry in item_ids})
    if not ids:
        return {}
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Stock mutations must run inside transaction.atomic().")
    items = list(InventoryItem.objects.select_for_update().filter(id__in=ids))
    if len(items) != len(ids):
        raise DomainError("Inventory item not found.")
    return {str(item.id): item for item in items}


def finished_item_for(product: Product) -> InventoryItem | None:
    return InventoryItem.objects.filter(product=product, kind=ItemKind.FINISHED).first()


def require_stock(item: InventoryItem, location: str, quantity, label: str) -> None:
    available = stock_qty(item.id, location)
    if available + Decimal("0.000000001") < round_qty(quantity):
        raise DomainError(
            f"Not enough {label} at this location. Available: {format_qty(available)}, "
            f"requested: {format_qty(quantity)}."
        )


def add_movement(
    item: InventoryItem,
    location: str,
    quantity_delta,
    reason: str,
    *,
    ref_id=None,
    event_id=None,
    note: str = "",
    actor=None,
    created_at=None,
) -> StockMovement:
    delta = round_qty(quantity_delta)
    if delta == 0:
        raise DomainError("A stock movement must change the quantity.")
    return StockMovement.objects.create(
        item=item,
        location=location,
        quantity_delta=delta,
        reason=reason,
        ref_id=ref_id,
        event_id=event_id if event_id is not None else ref_id,
        note=note,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
        created_by_label=actor_label(actor),
        **({"created_at": created_at} if created_at else {}),
    )


def create_item(
    *,
    name: str,
    kind: str,
    unit: str,
    cost_per_unit_cents: int,
    reorder_level,
    actor=None,
) -> InventoryItem:
    if kind == ItemKind.FINISHED:
        raise DomainError("Finished goods are created by production, not manually.")
    if cost_per_unit_cents < 0:
        raise DomainError("Unit cost is invalid.")
    if float(reorder_level) < 0:
        raise DomainError("Reorder level cannot be negative.")
    prefix = "PK" if kind == ItemKind.PACKAGING else "RM"
    with transaction.atomic():
        sku = next_sequence(f"sku_{kind}", prefix, start=0, pad=3)
        return InventoryItem.objects.create(
            sku=sku,
            name=name,
            kind=kind,
            unit=unit,
            cost_per_unit_cents=cost_per_unit_cents,
            reorder_level=reorder_level,
        )


def adjust_stock(
    *,
    item_id,
    location: str,
    mode: str,
    quantity,
    note: str = "",
    actor=None,
) -> StockMovement:
    qty = round_qty(quantity)
    if qty <= 0:
        raise DomainError("Quantity must be greater than zero.")
    if mode not in {"add", "remove", "wastage"}:
        raise DomainError("Unknown adjustment mode.")
    reason = "wastage" if mode == "wastage" else "adjustment"

    with transaction.atomic():
        items = lock_items([item_id])
        item = items[str(item_id)]
        if mode != "add":
            require_stock(item, location, qty, item.name)
        movement = add_movement(
            item,
            location,
            qty if mode == "add" else -qty,
            reason,
            note=note
            or ("Wastage recorded" if mode == "wastage" else "Manual adjustment"),
            actor=actor,
        )
    return movement
