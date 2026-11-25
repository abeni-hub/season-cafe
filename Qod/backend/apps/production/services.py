from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.audit.services import log_activity
from apps.core.constants import round_qty
from apps.core.errors import DomainError
from apps.core.services import next_code
from apps.inventory.models import MovementReason, StockMovement
from apps.inventory.services import (
    add_movement,
    finished_item_for,
    lock_items,
    require_stock,
    stock_qty,
)
from apps.orders.models import Order, OrderStatus
from apps.products.models import Product
from apps.recipes.models import Recipe
from .models import BatchStatus, ProductionBatch

BATCH_STATUS_LABELS = {
    BatchStatus.PENDING: "Pending",
    BatchStatus.SCHEDULED: "Scheduled",
    BatchStatus.IN_PRODUCTION: "In production",
    BatchStatus.QUALITY_CHECK: "Quality check",
    BatchStatus.COMPLETED: "Completed",
    BatchStatus.READY: "Ready for fulfilment",
    BatchStatus.CANCELLED: "Cancelled",
}

BATCH_FLOW = {
    BatchStatus.PENDING: [BatchStatus.SCHEDULED, BatchStatus.CANCELLED],
    BatchStatus.SCHEDULED: [BatchStatus.IN_PRODUCTION, BatchStatus.CANCELLED],
    BatchStatus.IN_PRODUCTION: [BatchStatus.QUALITY_CHECK, BatchStatus.CANCELLED],
    BatchStatus.QUALITY_CHECK: [BatchStatus.COMPLETED, BatchStatus.CANCELLED],
    BatchStatus.COMPLETED: [BatchStatus.READY],
    BatchStatus.READY: [],
    BatchStatus.CANCELLED: [],
}


def create_batch(
    *,
    quantity,
    location,
    title="",
    product_id=None,
    recipe_id=None,
    order_id=None,
    scheduled_for=None,
    assigned_employee_id=None,
    notes="",
    actor,
) -> ProductionBatch:
    qty = round_qty(quantity)
    if qty <= 0:
        raise DomainError("Batch quantity must be greater than zero.")

    with transaction.atomic():
        product = None
        recipe = None
        if product_id:
            product = Product.objects.filter(pk=product_id).first()
            if product is None:
                raise DomainError("Product not found.")
            if not (title or "").strip():
                title = f"{product.name} — batch"
            if recipe_id:
                recipe = Recipe.objects.filter(pk=recipe_id).first()
                if recipe is None or recipe.product_id != product.id:
                    raise DomainError("The selected recipe does not belong to this product.")
        elif not (title or "").strip():
            raise DomainError("Provide a title for a custom production batch.")

        order = None
        if order_id:
            order = Order.objects.select_for_update().filter(pk=order_id).first()
            if order is None:
                raise DomainError("Linked customer order not found.")
            if order.status in {OrderStatus.FULFILLED, OrderStatus.CANCELLED}:
                raise DomainError("Production cannot be scheduled for a fulfilled or cancelled order.")
            if order.status == OrderStatus.CONFIRMED:
                order.status = OrderStatus.IN_PRODUCTION
                order.save(update_fields=["status", "updated_at"])

        employee = None
        if assigned_employee_id:
            employee = get_user_model().objects.filter(pk=assigned_employee_id, is_active=True).first()
            if employee is None:
                raise DomainError("Select a valid active employee.")

        batch = ProductionBatch.objects.create(
            code=next_code("batch"),
            title=(title or "").strip(),
            product=product,
            recipe=recipe,
            order=order,
            quantity=qty,
            location=location,
            status=BatchStatus.SCHEDULED,
            scheduled_for=scheduled_for or None,
            assigned_employee=employee,
            notes=(notes or "").strip(),
            created_by=actor,
        )
        log_activity(
            f"{batch.code} scheduled — {batch.quantity} × {batch.title}.", actor=actor
        )
    return batch


def _complete_batch(batch: ProductionBatch, actor) -> None:
    if StockMovement.objects.filter(
        ref_id=batch.id, reason=MovementReason.PRODUCTION_OUTPUT
    ).exists():
        raise DomainError("This batch has already created finished goods.")

    recipe = batch.recipe
    consumption = []
    output_item = None
    needed_items = []
    if batch.product_id:
        output_item = finished_item_for(batch.product)
        if output_item is None:
            raise DomainError("Finished-goods record missing for the batch product.")
        needed_items.append(output_item.id)
    if batch.product_id and recipe:
        multiplier = Decimal(batch.quantity) / Decimal(recipe.yield_quantity)
        for line in recipe.lines.select_related("item"):
            quantity = round_qty(Decimal(line.quantity) * multiplier)
            consumption.append((line.item, quantity))
            needed_items.append(line.item_id)

    locked = lock_items(needed_items)
    for item, quantity in consumption:
        require_stock(locked[str(item.id)], batch.location, quantity, item.name)
    for item, quantity in consumption:
        add_movement(
            locked[str(item.id)],
            batch.location,
            -quantity,
            MovementReason.PRODUCTION_CONSUMPTION,
            ref_id=batch.id,
            note=f"Consumption for {batch.code}",
            actor=actor,
        )
    if output_item is not None:
        suffix = "" if recipe else " (no recipe attached)"
        add_movement(
            locked[str(output_item.id)],
            batch.location,
            batch.quantity,
            MovementReason.PRODUCTION_OUTPUT,
            ref_id=batch.id,
            note=f"Output of {batch.code}{suffix}",
            actor=actor,
        )

    if batch.order_id:
        order = Order.objects.select_for_update().get(pk=batch.order_id)
        if order.status == OrderStatus.IN_PRODUCTION:
            order.status = OrderStatus.READY
            order.save(update_fields=["status", "updated_at"])


def advance_batch(*, batch_id, next_status: str, actor) -> ProductionBatch:
    if next_status not in dict(BatchStatus.choices):
        raise DomainError("Unknown batch status.")
    with transaction.atomic():
        pre = ProductionBatch.objects.filter(pk=batch_id).values("order_id").first()
        if pre is None:
            raise DomainError("Production batch not found.")
        # Orders are locked before batches so completion cannot deadlock with
        # order cancellation, which locks the order and then its batches.
        if pre["order_id"]:
            Order.objects.select_for_update().filter(pk=pre["order_id"]).first()
        batch = ProductionBatch.objects.select_for_update().get(pk=batch_id)
        if next_status not in BATCH_FLOW.get(batch.status, []):
            raise DomainError(
                f"{batch.code} cannot move from {BATCH_STATUS_LABELS[batch.status]} to "
                f"{BATCH_STATUS_LABELS[next_status]}."
            )
        now = timezone.now()
        if next_status == BatchStatus.IN_PRODUCTION:
            batch.started_at = now
        if next_status == BatchStatus.COMPLETED:
            _complete_batch(batch, actor)
            batch.completed_at = now
        batch.status = next_status
        batch.save(update_fields=["status", "started_at", "completed_at", "updated_at"])
        log_activity(
            f"{batch.code} moved to {BATCH_STATUS_LABELS[next_status]}.", actor=actor
        )
    return batch


def ingredient_availability(batch: ProductionBatch):
    if not batch.recipe_id or not batch.product_id:
        return []
    recipe = batch.recipe
    multiplier = Decimal(batch.quantity) / Decimal(recipe.yield_quantity)
    rows = []
    for line in recipe.lines.select_related("item"):
        required = round_qty(Decimal(line.quantity) * multiplier)
        available = stock_qty(line.item_id, batch.location)
        rows.append(
            {
                "name": line.item.name,
                "required": required,
                "available": available,
                "unit": line.item.unit,
                "short": available < required,
            }
        )
    return rows
