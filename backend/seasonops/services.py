import hashlib
import json
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import (
    CakeProduct,
    AuditEvent,
    BusinessSettings,
    Customer,
    CustomerOrder,
    CustomerOrderLine,
    CustomerOrderStatusHistory,
    Ingredient,
    IngredientBalance,
    IngredientPurchase,
    IngredientPurchaseLine,
    IngredientSupplier,
    Location,
    Payment,
    ProductBalance,
    ProductionBatch,
    ProductionConsumption,
    Recipe,
    Sale,
    SaleCancellation,
    SaleRefund,
    SaleRefundLine,
    SaleLine,
    StockMovement,
    StockTransfer,
    StockTransferReceipt,
    TransferShipment,
    User,
)
from .units import convert_quantity, unit_cost_in_stock_unit


def log_activity(*, location, actor, action, summary, target_type, target_id):
    return AuditEvent.objects.create(
        location=location,
        actor=actor,
        action=action,
        summary=summary,
        target_type=target_type,
        target_id=str(target_id),
    )


def authorize_business_actor(*, actor, location, permission):
    if actor is None or not actor.is_authenticated:
        raise PermissionDenied("An authenticated business account is required.")
    if location is None or not location.is_active:
        raise PermissionDenied("The selected business location is unavailable.")
    if actor.is_superuser or actor.role == User.Role.OWNER:
        return
    if actor.location_id != location.pk:
        raise PermissionDenied("This account cannot operate at the selected location.")
    if permission not in actor.effective_business_permissions:
        raise PermissionDenied("This account is not permitted to perform this operation.")


def _request_fingerprint(payload):
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


def _normalized_customer_phone(value):
    digits = "".join(character for character in value if character.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 10 and digits.startswith("0"):
        digits = f"251{digits[1:]}"
    elif len(digits) == 9 and digits[0] in {"7", "9"}:
        digits = f"251{digits}"
    return digits or value.strip().casefold()


@transaction.atomic
def record_stock(
    *,
    location,
    quantity_delta,
    kind,
    actor,
    ingredient=None,
    product=None,
    reference="",
    note="",
    service_authorized=False,
):
    if (ingredient is None) == (product is None):
        raise ValidationError("A stock movement must reference exactly one ingredient or product.")
    delta = Decimal(quantity_delta)
    if not delta:
        raise ValidationError("A stock movement quantity cannot be zero.")
    if not service_authorized:
        permission_by_kind = {
            StockMovement.Kind.PURCHASE: "purchases",
            StockMovement.Kind.PRODUCTION_USE: "production",
            StockMovement.Kind.PRODUCTION_OUTPUT: "production",
            StockMovement.Kind.SALE: "sales",
            StockMovement.Kind.SALE_RETURN: "sales",
            StockMovement.Kind.SALE_REVERSAL: "sales",
            StockMovement.Kind.ADJUSTMENT: "inventory_adjust",
            StockMovement.Kind.TRANSFER_IN: "transfers",
            StockMovement.Kind.TRANSFER_OUT: "transfers",
            StockMovement.Kind.TRANSFER_LOSS: "transfers",
        }
        permission = permission_by_kind.get(kind)
        if permission is None:
            raise ValidationError({"kind": "Choose a valid stock movement type."})
        authorize_business_actor(actor=actor, location=location, permission=permission)

    if ingredient is not None:
        Ingredient.objects.select_for_update().get(pk=ingredient.pk)
        balance, _ = IngredientBalance.objects.select_for_update().get_or_create(
            location=location,
            ingredient=ingredient,
        )
    else:
        CakeProduct.objects.select_for_update().get(pk=product.pk)
        balance, _ = ProductBalance.objects.select_for_update().get_or_create(
            location=location,
            product=product,
        )

    next_quantity = balance.quantity + delta
    if next_quantity < 0:
        raise ValidationError("The movement would make stock negative.")
    if delta < 0:
        reservations = StockTransfer.objects.filter(
            source_location=location,
            status__in=[StockTransfer.Status.IN_TRANSIT, StockTransfer.Status.PARTIALLY_RECEIVED],
            legacy_source_deducted=False,
        )
        reservations = reservations.filter(ingredient=ingredient) if ingredient else reservations.filter(product=product)
        reserved_quantity = reservations.aggregate(
            total=Sum(F("quantity") - F("received_quantity")),
        )["total"] or Decimal("0")
        if next_quantity < reserved_quantity:
            raise ValidationError("This stock is reserved for an in-transit transfer.")

    balance.quantity = next_quantity
    balance.save(update_fields=["quantity"])
    movement = StockMovement.objects.create(
        location=location,
        ingredient=ingredient,
        product=product,
        quantity_delta=delta,
        kind=kind,
        reference=reference,
        note=note,
        actor=actor,
    )
    item = ingredient or product
    log_activity(
        location=location,
        actor=actor,
        action="stock_movement",
        summary=f"{item.name}: {delta:+} {ingredient.unit if ingredient else product.selling_unit}",
        target_type="stock_movement",
        target_id=movement.pk,
    )
    return movement


def _same_purchase_payload(purchase, *, location, supplier, reference, note, lines):
    existing_lines = list(
        purchase.lines.order_by("ingredient_id").values("ingredient_id", "quantity", "unit", "unit_cost"),
    )
    requested_lines = sorted(
        [
            {
                "ingredient_id": line["ingredient"].pk,
                "quantity": line["quantity"],
                "unit": line["unit"],
                "unit_cost": line["unit_cost"],
            }
            for line in lines
        ],
        key=lambda line: line["ingredient_id"],
    )
    return (
        purchase.location_id == location.pk
        and purchase.supplier_id == (supplier.pk if supplier else None)
        and purchase.reference == reference
        and purchase.note == note
        and existing_lines == requested_lines
    )


@transaction.atomic
def receive_purchase(
    *,
    location,
    actor,
    lines,
    supplier=None,
    reference="",
    note="",
    idempotency_key=None,
    purchased_at=None,
):
    authorize_business_actor(actor=actor, location=location, permission="purchases")
    if not lines:
        raise ValidationError("A purchase must include at least one ingredient.")
    if idempotency_key:
        existing = IngredientPurchase.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if not _same_purchase_payload(
                existing,
                location=location,
                supplier=supplier,
                reference=reference,
                note=note,
                lines=lines,
            ):
                raise ValidationError({"idempotency_key": "This key was already used for a different purchase."})
            return existing
    approval_required = BusinessSettings.load().require_purchase_approval
    try:
        with transaction.atomic():
            purchase = IngredientPurchase.objects.create(
                location=location,
                supplier=supplier,
                recorded_by=actor,
                reference=reference,
                note=note,
                idempotency_key=idempotency_key,
                purchased_at=purchased_at or timezone.now(),
                status=IngredientPurchase.Status.PENDING if approval_required else IngredientPurchase.Status.APPROVED,
                approved_by=None if approval_required else actor,
                approved_at=None if approval_required else timezone.now(),
            )
    except IntegrityError:
        if not idempotency_key:
            raise
        existing = IngredientPurchase.objects.get(idempotency_key=idempotency_key)
        if not _same_purchase_payload(
            existing,
            location=location,
            supplier=supplier,
            reference=reference,
            note=note,
            lines=lines,
        ):
            raise ValidationError({"idempotency_key": "This key was already used for a different purchase."}) from None
        return existing

    for line in lines:
        ingredient = line["ingredient"]
        if not ingredient.is_active:
            raise ValidationError(f"{ingredient.name} is inactive.")
        if any(other["ingredient"].pk == ingredient.pk for other in lines if other is not line):
            raise ValidationError({"lines": f"Include {ingredient.name} only once in a purchase."})
        stock_quantity = convert_quantity(line["quantity"], line["unit"], ingredient.unit)
        IngredientPurchaseLine.objects.create(
            purchase=purchase,
            ingredient=ingredient,
            quantity=line["quantity"],
            unit=line["unit"],
            unit_cost=line["unit_cost"],
            stock_quantity=stock_quantity,
        )
    if purchase.status == IngredientPurchase.Status.APPROVED:
        _apply_purchase_stock(purchase, actor=actor)
    log_activity(
        location=location,
        actor=actor,
        action="purchase_pending" if approval_required else "ingredient_purchase",
        summary=(
            f"Purchase #{purchase.pk} is awaiting approval."
            if approval_required
            else f"Approved ingredient purchase #{purchase.pk}."
        ),
        target_type="ingredient_purchase",
        target_id=purchase.pk,
    )
    return purchase


def _apply_purchase_stock(purchase, *, actor):
    for line in purchase.lines.select_related("ingredient"):
        if purchase.supplier_id:
            IngredientSupplier.objects.update_or_create(
                ingredient=line.ingredient,
                supplier=purchase.supplier,
                defaults={
                    "last_unit_cost": unit_cost_in_stock_unit(
                        line.total_cost,
                        line.stock_quantity,
                    ),
                },
            )
        record_stock(
            location=purchase.location,
            ingredient=line.ingredient,
            quantity_delta=line.stock_quantity,
            kind=StockMovement.Kind.PURCHASE,
            reference=purchase.reference or f"purchase:{purchase.pk}",
            note=purchase.note,
            actor=actor,
            service_authorized=True,
        )


@transaction.atomic
def approve_purchase(*, purchase, actor):
    purchase = IngredientPurchase.objects.select_for_update().get(pk=purchase.pk)
    authorize_business_actor(actor=actor, location=purchase.location, permission="purchases_approve")
    if purchase.status != IngredientPurchase.Status.PENDING:
        raise ValidationError("Only a purchase awaiting approval can be approved.")
    purchase.status = IngredientPurchase.Status.APPROVED
    purchase.approved_by = actor
    purchase.approved_at = timezone.now()
    purchase.save(update_fields=["status", "approved_by", "approved_at"])
    _apply_purchase_stock(purchase, actor=actor)
    log_activity(
        location=purchase.location,
        actor=actor,
        action="purchase_approved",
        summary=f"Approved ingredient purchase #{purchase.pk}.",
        target_type="ingredient_purchase",
        target_id=purchase.pk,
    )
    return purchase


@transaction.atomic
def reject_purchase(*, purchase, actor, reason):
    purchase = IngredientPurchase.objects.select_for_update().get(pk=purchase.pk)
    authorize_business_actor(actor=actor, location=purchase.location, permission="purchases_approve")
    if purchase.status != IngredientPurchase.Status.PENDING:
        raise ValidationError("Only a purchase awaiting approval can be rejected.")
    purchase.status = IngredientPurchase.Status.REJECTED
    purchase.approved_by = actor
    purchase.approved_at = timezone.now()
    purchase.rejection_reason = reason
    purchase.save(update_fields=["status", "approved_by", "approved_at", "rejection_reason"])
    log_activity(
        location=purchase.location,
        actor=actor,
        action="purchase_rejected",
        summary=f"Rejected ingredient purchase #{purchase.pk}: {reason}",
        target_type="ingredient_purchase",
        target_id=purchase.pk,
    )
    return purchase


@transaction.atomic
def produce_cakes(
    *,
    location,
    actor,
    product,
    quantity,
    note="",
    actual_consumption=None,
    adjustment_note="",
    wastage_quantity=0,
    wastage_note="",
    idempotency_key=None,
):
    authorize_business_actor(actor=actor, location=location, permission="production")
    if quantity < 1:
        raise ValidationError("Production quantity must be at least one.")
    if wastage_quantity < 0 or wastage_quantity > quantity:
        raise ValidationError({"wastage_quantity": "Wastage must be between zero and total production quantity."})
    if wastage_quantity and not wastage_note.strip():
        raise ValidationError({"wastage_note": "Explain the recorded production wastage."})
    if not product.is_active:
        raise ValidationError("Inactive cake products cannot be produced.")
    actual_payload = sorted(
        [
            {
                "ingredient": line["ingredient"].pk,
                "quantity": str(line["quantity"]),
                "unit": line["unit"],
            }
            for line in (actual_consumption or [])
        ],
        key=lambda line: (line["ingredient"], line["unit"], line["quantity"]),
    )
    fingerprint = _request_fingerprint(
        {
            "location": location.pk,
            "product": product.pk,
            "quantity": quantity,
            "note": note,
            "adjustment_note": adjustment_note,
            "wastage_quantity": wastage_quantity,
            "wastage_note": wastage_note,
            "actual_consumption": actual_payload,
        },
    )
    if idempotency_key:
        existing = ProductionBatch.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if existing.request_fingerprint != fingerprint:
                raise ValidationError({"idempotency_key": "This key was already used for a different production batch."})
            return existing
    recipe = Recipe.objects.select_for_update().filter(product=product, is_current=True).first()
    if recipe is None or not recipe.is_current or not recipe.ingredients.exists():
        raise ValidationError("Add a complete recipe before recording production.")

    recipe_lines = list(recipe.ingredients.select_related("ingredient").order_by("ingredient_id"))
    recipe_ingredients = {line.ingredient_id: line for line in recipe_lines}
    actual_by_ingredient = {}
    if actual_consumption is not None:
        for line in actual_consumption:
            ingredient = line["ingredient"]
            if ingredient.pk not in recipe_ingredients:
                raise ValidationError({"actual_consumption": f"{ingredient.name} is not in this recipe."})
            if ingredient.pk in actual_by_ingredient:
                raise ValidationError({"actual_consumption": f"Include {ingredient.name} only once."})
            actual_by_ingredient[ingredient.pk] = line

    estimate = Decimal("0.00")
    complete_estimate = True
    recipe_quantities = {}
    for recipe_line in recipe_lines:
        stock_quantity = convert_quantity(
            recipe_line.quantity * quantity,
            recipe_line.unit,
            recipe_line.ingredient.unit,
        )
        recipe_quantities[recipe_line.ingredient_id] = stock_quantity
        latest_purchase_line = IngredientPurchaseLine.objects.filter(
            ingredient=recipe_line.ingredient,
            purchase__status=IngredientPurchase.Status.APPROVED,
        ).order_by("-purchase__purchased_at", "-pk").first()
        if latest_purchase_line:
            unit_cost = unit_cost_in_stock_unit(
                latest_purchase_line.total_cost,
                latest_purchase_line.stock_quantity,
            )
            estimate += stock_quantity * unit_cost
        else:
            complete_estimate = False

    actual_quantities = {}
    for recipe_line in recipe_lines:
        actual_line = actual_by_ingredient.get(recipe_line.ingredient_id)
        actual_quantities[recipe_line.ingredient_id] = (
            convert_quantity(
                actual_line["quantity"],
                actual_line["unit"],
                recipe_line.ingredient.unit,
            )
            if actual_line
            else recipe_quantities[recipe_line.ingredient_id]
        )
    if any(
        actual_quantities[line.ingredient_id] != recipe_quantities[line.ingredient_id]
        for line in recipe_lines
    ) and not adjustment_note.strip():
        raise ValidationError({"adjustment_note": "Explain any actual ingredient use that differs from the recipe."})

    try:
        with transaction.atomic():
            batch = ProductionBatch.objects.create(
                location=location,
                recorded_by=actor,
                product=product,
                recipe=recipe,
                quantity=quantity,
                note=note,
                adjustment_note=adjustment_note,
                wastage_quantity=wastage_quantity,
                wastage_note=wastage_note,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                estimated_cost=estimate.quantize(Decimal("0.01")) if complete_estimate else None,
            )
    except IntegrityError:
        if not idempotency_key:
            raise
        existing = ProductionBatch.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None or existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different production batch."}) from None
        return existing
    reference = f"production:{batch.pk}"
    actual_cost = Decimal("0")
    complete_actual_cost = True
    for recipe_line in recipe_lines:
        consumption_quantity = actual_quantities[recipe_line.ingredient_id]
        latest_purchase_line = IngredientPurchaseLine.objects.filter(
            ingredient=recipe_line.ingredient,
            purchase__status=IngredientPurchase.Status.APPROVED,
        ).order_by("-purchase__purchased_at", "-pk").first()
        unit_cost = (
            unit_cost_in_stock_unit(
                latest_purchase_line.total_cost,
                latest_purchase_line.stock_quantity,
            )
            if latest_purchase_line
            else None
        )
        total_cost = (
            (consumption_quantity * unit_cost).quantize(Decimal("0.01"))
            if unit_cost is not None
            else None
        )
        ProductionConsumption.objects.create(
            batch=batch,
            ingredient=recipe_line.ingredient,
            quantity=consumption_quantity,
            unit=recipe_line.ingredient.unit,
            unit_cost=unit_cost,
            total_cost=total_cost,
        )
        if total_cost is None:
            complete_actual_cost = False
        else:
            actual_cost += total_cost
        record_stock(
            location=location,
            ingredient=recipe_line.ingredient,
            quantity_delta=-consumption_quantity,
            kind=StockMovement.Kind.PRODUCTION_USE,
            reference=reference,
            note=note,
            actor=actor,
            service_authorized=True,
        )
    batch.actual_cost = actual_cost.quantize(Decimal("0.01")) if complete_actual_cost else None
    batch.save(update_fields=["actual_cost"])
    finished_quantity = quantity - wastage_quantity
    if finished_quantity > 0:
        record_stock(
            location=location,
            product=product,
            quantity_delta=finished_quantity,
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            reference=reference,
            note=note,
            actor=actor,
            service_authorized=True,
        )
    log_activity(
        location=location,
        actor=actor,
        action="production",
        summary=(
            f"Recorded {finished_quantity} {product.name} ready for stock"
            + (f" and {wastage_quantity} wasted." if wastage_quantity else ".")
        ),
        target_type="production_batch",
        target_id=batch.pk,
    )
    return batch


@transaction.atomic
def create_order(
    *,
    location,
    actor,
    customer_name,
    customer_phone,
    requested_for,
    lines,
    customer_email="",
    fulfillment="pickup",
    delivery_address="",
    notes="",
    source=CustomerOrder.Source.STAFF,
    idempotency_key=None,
):
    if actor is None:
        if location is not None or source != CustomerOrder.Source.WEBSITE:
            raise PermissionDenied("Anonymous order intake is only allowed for unassigned website orders.")
    else:
        authorize_business_actor(actor=actor, location=location, permission="orders")
    if not lines:
        raise ValidationError("An order must contain at least one cake.")
    canonical_lines = sorted(
        [
            {
                "product": line["product"].pk,
                "quantity": line["quantity"],
                "size": line.get("size", ""),
            }
            for line in lines
        ],
        key=lambda line: (line["product"], line["quantity"], line["size"]),
    )
    fingerprint = _request_fingerprint(
        {
            "location": location.pk if location else None,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "fulfillment": fulfillment,
            "delivery_address": delivery_address,
            "requested_for": requested_for,
            "notes": notes,
            "source": source,
            "lines": canonical_lines,
        },
    )
    if idempotency_key:
        existing = CustomerOrder.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if existing.request_fingerprint != fingerprint:
                raise ValidationError({"idempotency_key": "This key was already used for a different order."})
            return existing
    try:
        with transaction.atomic():
            normalized_phone = _normalized_customer_phone(customer_phone)
            customer, created = Customer.objects.get_or_create(
                normalized_phone=normalized_phone,
                defaults={
                    "name": customer_name.strip(),
                    "phone": customer_phone.strip(),
                    "email": customer_email.strip(),
                },
            )
            if not created:
                customer = Customer.objects.select_for_update().get(pk=customer.pk)
                customer.name = customer_name.strip()
                customer.phone = customer_phone.strip()
                if customer_email.strip():
                    customer.email = customer_email.strip()
                customer.save(update_fields=["name", "phone", "email", "updated_at"])
            order = CustomerOrder.objects.create(
                location=location,
                customer=customer,
                created_by=actor,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                fulfillment=fulfillment,
                delivery_address=delivery_address,
                requested_for=requested_for,
                notes=notes,
                source=source,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
            )
    except IntegrityError:
        if not idempotency_key:
            raise
        existing = CustomerOrder.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None or existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different order."}) from None
        return existing
    for line in lines:
        if not line["product"].is_active:
            raise ValidationError(f"{line['product'].name} is inactive.")
        unit_price = line.get("unit_price")
        if unit_price is None:
            unit_price = line["product"].unit_price
        CustomerOrderLine.objects.create(
            order=order,
            product=line["product"],
            quantity=line["quantity"],
            size=line.get("size", ""),
            unit_price=unit_price,
        )
    CustomerOrderStatusHistory.objects.create(
        order=order,
        status=order.status,
        note="Order received.",
        changed_by=actor,
    )
    log_activity(
        location=location,
        actor=actor,
        action="website_order" if source == CustomerOrder.Source.WEBSITE else "customer_order",
        summary=(
            f"Received website order {order.order_number}."
            if source == CustomerOrder.Source.WEBSITE
            else f"Recorded customer order {order.order_number}."
        ),
        target_type="customer_order",
        target_id=order.pk,
    )
    return order


@transaction.atomic
def record_order_payment(
    *,
    order,
    actor,
    method,
    amount,
    idempotency_key,
    bank_name="",
    payment_date=None,
):
    authorize_business_actor(actor=actor, location=order.location, permission="orders")
    bank_name = _validate_bank_details(method=method, bank_name=bank_name)
    fingerprint = _request_fingerprint({
        "order": order.pk,
        "actor": actor.pk,
        "method": method,
        "amount": str(amount),
        "bank_name": bank_name,
        "payment_date": str(payment_date) if payment_date else None,
    })
    existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different payment."})
        return existing
    order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
    if order.status in {CustomerOrder.Status.CANCELLED, CustomerOrder.Status.COMPLETED}:
        raise ValidationError("Payments cannot be added to a cancelled or completed order.")
    amount_decimal = Decimal(str(amount))
    if amount_decimal <= 0:
        raise ValidationError("Payment amount must be greater than zero.")
    if order.total > 0 and amount_decimal > order.amount_due:
        raise ValidationError("Payment cannot exceed the remaining order balance.")
    try:
        with transaction.atomic():
            payment = Payment.objects.create(
                order=order,
                received_by=actor,
                method=method,
                amount=amount_decimal,
                bank_name=bank_name,
                payment_date=payment_date or timezone.localdate(),
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
            )
    except IntegrityError:
        existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None or existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different payment."}) from None
        return existing

    log_activity(
        location=order.location,
        actor=actor,
        action="order_payment",
        summary=f"Recorded {payment.method.replace('_', ' ')} advance payment of {amount_decimal:.2f} ETB for order {order.order_number}.",
        target_type="payment",
        target_id=payment.pk,
    )
    return payment


def _sale_fingerprint(*, location, actor, order, note, items, payments):
    normalized_items = sorted(
        [
            {
                "product": item["product"].pk,
                "quantity": item["quantity"],
                "unit_price": item.get("unit_price"),
            }
            for item in items
        ],
        key=lambda item: (item["product"], str(item["unit_price"])),
    )
    normalized_payments = [
        {
            "method": payment["method"],
            "amount": payment["amount"],
            "bank_name": payment.get("bank_name", ""),
            "payment_date": payment.get("payment_date"),
        }
        for payment in payments
    ]
    return _request_fingerprint({
        "location": location.pk,
        "actor": actor.pk,
        "order": order.pk if order else None,
        "note": note,
        "items": normalized_items,
        "payments": normalized_payments,
    })


def _validate_bank_details(*, method, bank_name):
    bank_name = (bank_name or "").strip()
    if method == Payment.Method.BANK_TRANSFER and not bank_name:
        raise ValidationError({"bank_name": "Enter the bank name for a bank transfer."})
    if method != Payment.Method.BANK_TRANSFER and bank_name:
        raise ValidationError({"bank_name": "Bank name is only used for bank transfers."})
    return bank_name


@transaction.atomic
def create_sale(*, location, actor, items, payments, idempotency_key, note="", order=None):
    authorize_business_actor(actor=actor, location=location, permission="sales")
    if not items:
        raise ValidationError("A sale must include at least one cake.")
    if not idempotency_key:
        raise ValidationError({"idempotency_key": "A unique sale request key is required."})
    fingerprint = _sale_fingerprint(
        location=location,
        actor=actor,
        order=order,
        note=note,
        items=items,
        payments=payments,
    )
    existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different sale."})
        return existing

    grouped = {}
    for item in items:
        product_id = item["product"].pk
        current = grouped.get(product_id)
        if current is None:
            grouped[product_id] = {
                "product": item["product"],
                "quantity": item["quantity"],
                "unit_price": item.get("unit_price"),
            }
        else:
            if (
                current["unit_price"] is not None
                and item.get("unit_price") is not None
                and current["unit_price"] != item["unit_price"]
            ):
                raise ValidationError({"items": "A cake must use one catalog price per sale."})
            current["quantity"] += item["quantity"]
            if current["unit_price"] is None:
                current["unit_price"] = item.get("unit_price")
    items = [grouped[key] for key in sorted(grouped)]

    if order:
        order = CustomerOrder.objects.select_for_update().get(pk=order.pk)
        existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if existing.request_fingerprint != fingerprint:
                raise ValidationError({"idempotency_key": "This key was already used for a different sale."})
            return existing
        if order.location_id != location.pk:
            raise ValidationError({"order": "Choose an order assigned to this café."})
        if order.status in {CustomerOrder.Status.CANCELLED, CustomerOrder.Status.COMPLETED}:
            raise ValidationError({"order": "Cancelled or completed orders cannot be settled."})
        if Sale.objects.filter(order=order).exists():
            raise ValidationError({"order": "This order already has a sale. Record any remaining payment on that sale."})
        requested = {}
        for line in order.lines.all():
            requested[line.product_id] = requested.get(line.product_id, 0) + line.quantity
        sold = {}
        for line in items:
            sold[line["product"].pk] = sold.get(line["product"].pk, 0) + line["quantity"]
        if sold != requested:
            raise ValidationError({"items": "A sale linked to an order must include its exact products and quantities."})

    locked_products = {}
    for item in items:
        product = CakeProduct.objects.select_for_update().get(pk=item["product"].pk)
        existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if existing.request_fingerprint != fingerprint:
                raise ValidationError({"idempotency_key": "This key was already used for a different sale."})
            return existing
        if not product.is_active:
            raise ValidationError(f"{product.name} is inactive.")
        if product.unit_price is None:
            raise ValidationError({"items": f"Set a selling price for {product.name} before recording a sale."})
        submitted_price = item.get("unit_price")
        if order is None and submitted_price is not None and submitted_price != product.unit_price:
            raise ValidationError({
                "items": f"The selling price for {product.name} changed. Refresh the product list and try again.",
            })
        locked_products[product.pk] = product

    sale = None
    try:
        with transaction.atomic():
            sale = Sale.objects.create(
                location=location,
                cashier=actor,
                note=note,
                order=order,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
            )
    except IntegrityError:
        existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None:
            raise
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different sale."}) from None
        return existing

    order_line_prices = {}
    if order:
        for o_line in order.lines.all():
            if o_line.unit_price is not None:
                order_line_prices[o_line.product_id] = o_line.unit_price

    total = Decimal("0.00")
    for item in items:
        product = locked_products[item["product"].pk]
        line_price = order_line_prices.get(product.pk) or (item.get("unit_price") if order else product.unit_price)
        line = SaleLine.objects.create(
            sale=sale,
            product=product,
            quantity=item["quantity"],
            unit_price=line_price,
        )
        total += line.total

    if order:
        order.payments.filter(sale__isnull=True).update(sale=sale)
        if order.status != CustomerOrder.Status.COMPLETED:
            order.status = CustomerOrder.Status.COMPLETED
            order.save(update_fields=["status", "updated_at"])
            CustomerOrderStatusHistory.objects.create(
                order=order,
                previous_status=CustomerOrder.Status.READY if order.status == CustomerOrder.Status.READY else order.status,
                status=CustomerOrder.Status.COMPLETED,
                note="Order fulfilled and converted to sale.",
                changed_by=actor,
            )

    already_paid = sale.payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    payment_total = sum((payment["amount"] for payment in payments), Decimal("0.00"))
    if already_paid + payment_total > total:
        raise ValidationError("Payments cannot exceed the sale total.")
    for payment in payments:
        bank_name = _validate_bank_details(
            method=payment["method"],
            bank_name=payment.get("bank_name", ""),
        )
        Payment.objects.create(
            sale=sale,
            order=order,
            received_by=actor,
            method=payment["method"],
            amount=payment["amount"],
            bank_name=bank_name,
            payment_date=payment.get("payment_date") or timezone.localdate(),
        )

    for item in sorted(items, key=lambda row: row["product"].pk):
        record_stock(
            location=location,
            product=item["product"],
            quantity_delta=-item["quantity"],
            kind=StockMovement.Kind.SALE,
            reference=f"sale:{sale.pk}",
            note=note,
            actor=actor,
            service_authorized=True,
        )
    log_activity(
        location=location,
        actor=actor,
        action="sale",
        summary=f"Recorded sale #{sale.pk}.",
        target_type="sale",
        target_id=sale.pk,
    )
    for payment in sale.payments.all():
        log_activity(
            location=location,
            actor=actor,
            action="payment",
            summary=f"Recorded {payment.method.replace('_', ' ')} payment for sale #{sale.pk}.",
            target_type="payment",
            target_id=payment.pk,
        )
    return sale


@transaction.atomic
def collect_sale_payment(
    *,
    sale,
    actor,
    method,
    amount,
    idempotency_key,
    bank_name="",
    payment_date=None,
):
    authorize_business_actor(actor=actor, location=sale.location, permission="sales")
    bank_name = _validate_bank_details(method=method, bank_name=bank_name)
    fingerprint = _request_fingerprint({
        "sale": sale.pk,
        "actor": actor.pk,
        "method": method,
        "amount": amount,
        "bank_name": bank_name,
        "payment_date": payment_date,
    })
    existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different payment."})
        return existing
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different payment."})
        return existing
    if sale.status != Sale.Status.ACTIVE:
        raise ValidationError("Payments cannot be added to a cancelled sale.")
    total = sum((line.total for line in sale.lines.all()), Decimal("0.00"))
    already_paid = sale.payments.aggregate(total=Sum("amount"))["total"]
    already_paid = already_paid or Decimal("0.00")
    if amount > total - already_paid:
        raise ValidationError("Payment cannot exceed the remaining sale balance.")
    try:
        with transaction.atomic():
            payment = Payment.objects.create(
                sale=sale,
                received_by=actor,
                method=method,
                amount=amount,
                bank_name=bank_name,
                payment_date=payment_date or timezone.localdate(),
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
            )
    except IntegrityError:
        existing = Payment.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None:
            raise
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different payment."}) from None
        return existing
    log_activity(
        location=sale.location,
        actor=actor,
        action="payment",
        summary=f"Recorded {payment.method.replace('_', ' ')} payment for sale #{sale.pk}.",
        target_type="payment",
        target_id=payment.pk,
    )
    return payment


def _refund_fingerprint(*, sale, actor, method, amount, bank_name, refund_date, reason, items):
    return _request_fingerprint({
        "sale": sale.pk,
        "actor": actor.pk,
        "method": method,
        "amount": amount,
        "bank_name": bank_name,
        "refund_date": refund_date,
        "reason": reason,
        "items": sorted(
            [
                {"product": item["product"].pk, "quantity": item["quantity"]}
                for item in items
            ],
            key=lambda item: item["product"],
        ),
    })


@transaction.atomic
def refund_sale(
    *,
    sale,
    actor,
    items,
    idempotency_key,
    method,
    amount,
    reason,
    bank_name="",
    refund_date=None,
):
    authorize_business_actor(actor=actor, location=sale.location, permission="sales")
    bank_name = _validate_bank_details(method=method, bank_name=bank_name)
    refund_date = refund_date or timezone.localdate()
    fingerprint = _refund_fingerprint(
        sale=sale,
        actor=actor,
        method=method,
        amount=amount,
        bank_name=bank_name,
        refund_date=refund_date,
        reason=reason,
        items=items,
    )
    existing = SaleRefund.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different refund."})
        return existing

    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    existing = SaleRefund.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different refund."})
        return existing
    if sale.status != Sale.Status.ACTIVE:
        raise ValidationError("A cancelled sale cannot receive another refund.")
    paid = sale.payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    refunded = sale.refunds.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    if amount > paid - refunded:
        raise ValidationError("A refund cannot exceed the amount received and not already refunded.")

    returned_quantities = {}
    for item in items:
        product_id = item["product"].pk
        if product_id in returned_quantities:
            raise ValidationError({"items": "Each returned cake can only appear once."})
        sold = sale.lines.filter(product_id=product_id).aggregate(total=Sum("quantity"))["total"] or 0
        already_returned = SaleRefundLine.objects.filter(
            refund__sale=sale,
            product_id=product_id,
        ).aggregate(total=Sum("quantity"))["total"] or 0
        if item["quantity"] > sold - already_returned:
            raise ValidationError({"items": f"Returned quantity exceeds the unreturned sale quantity for {item['product'].name}."})
        returned_quantities[product_id] = item["quantity"]

    try:
        with transaction.atomic():
            refund = SaleRefund.objects.create(
                sale=sale,
                method=method,
                amount=amount,
                bank_name=bank_name,
                refund_date=refund_date,
                reason=reason,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                refunded_by=actor,
            )
    except IntegrityError:
        existing = SaleRefund.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None:
            raise
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different refund."}) from None
        return existing

    for item in items:
        SaleRefundLine.objects.create(
            refund=refund,
            product=item["product"],
            quantity=item["quantity"],
        )
        record_stock(
            location=sale.location,
            product=item["product"],
            quantity_delta=item["quantity"],
            kind=StockMovement.Kind.SALE_RETURN,
            reference=f"sale-refund:{refund.pk}",
            note=reason,
            actor=actor,
            service_authorized=True,
        )
    log_activity(
        location=sale.location,
        actor=actor,
        action="sale_refund",
        summary=f"Refunded {amount:.2f} ETB for sale #{sale.pk}.",
        target_type="sale_refund",
        target_id=refund.pk,
    )
    return refund


@transaction.atomic
def cancel_sale(*, sale, actor, idempotency_key, reason, confirm_restock):
    authorize_business_actor(actor=actor, location=sale.location, permission="sales")
    fingerprint = _request_fingerprint({
        "sale": sale.pk,
        "actor": actor.pk,
        "reason": reason,
        "confirm_restock": confirm_restock,
    })
    existing = SaleCancellation.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different cancellation."})
        return existing.sale
    if not confirm_restock:
        raise ValidationError({"confirm_restock": "Confirm that all cakes from this sale are being returned to stock."})

    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    existing = SaleCancellation.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different cancellation."})
        return existing.sale
    if sale.status != Sale.Status.ACTIVE:
        raise ValidationError("This sale has already been cancelled.")
    if sale.refunds.exists():
        raise ValidationError("A sale with a previous refund cannot be cancelled. Refund remaining items separately.")

    try:
        with transaction.atomic():
            cancellation = SaleCancellation.objects.create(
                sale=sale,
                reason=reason,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                cancelled_by=actor,
            )
    except IntegrityError:
        existing = SaleCancellation.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None:
            raise
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different cancellation."}) from None
        return existing.sale

    for payment in sale.payments.order_by("pk"):
        SaleRefund.objects.create(
            sale=sale,
            original_payment=payment,
            method=payment.method,
            amount=payment.amount,
            bank_name=payment.bank_name,
            refund_date=timezone.localdate(),
            reason=reason,
            refunded_by=actor,
        )
    for line in sale.lines.select_related("product").order_by("product_id"):
        record_stock(
            location=sale.location,
            product=line.product,
            quantity_delta=line.quantity,
            kind=StockMovement.Kind.SALE_REVERSAL,
            reference=f"sale-cancellation:{cancellation.pk}",
            note=reason,
            actor=actor,
            service_authorized=True,
        )
    sale.status = Sale.Status.CANCELLED
    sale.save(update_fields=["status"])
    log_activity(
        location=sale.location,
        actor=actor,
        action="sale_cancelled",
        summary=f"Cancelled sale #{sale.pk}: {reason}",
        target_type="sale_cancellation",
        target_id=cancellation.pk,
    )
    return sale


@transaction.atomic
def transfer_stock(
    *,
    source,
    destination,
    actor,
    quantity,
    ingredient=None,
    product=None,
    reference="",
    note="",
    shipment=None,
):
    authorize_business_actor(actor=actor, location=source, permission="transfers")
    if source.pk == destination.pk:
        raise ValidationError("Choose two different locations.")
    if source.kind == Location.Kind.CAFE:
        raise ValidationError({"source_location": "Finished stock dispatch must begin at the Home Bakery."})
    if (ingredient is None) == (product is None):
        raise ValidationError("A transfer must reference exactly one ingredient or product.")
    if quantity <= 0:
        raise ValidationError("Transfer quantity must be greater than zero.")
    item = ingredient or product
    (Ingredient if ingredient else CakeProduct).objects.select_for_update().get(pk=item.pk)
    balance_model = IngredientBalance if ingredient else ProductBalance
    balance_lookup = {"ingredient": ingredient} if ingredient else {"product": product}
    balance, _ = balance_model.objects.select_for_update().get_or_create(
        location=source,
        **balance_lookup,
    )
    active_transfers = StockTransfer.objects.filter(
        source_location=source,
        status__in=[StockTransfer.Status.IN_TRANSIT, StockTransfer.Status.PARTIALLY_RECEIVED],
        legacy_source_deducted=False,
    )
    active_transfers = active_transfers.filter(ingredient=ingredient) if ingredient else active_transfers.filter(product=product)
    reserved = active_transfers.aggregate(total=Sum(F("quantity") - F("received_quantity")))["total"] or Decimal("0")
    available = balance.quantity - reserved
    if quantity > available:
        unit = ingredient.unit if ingredient else product.selling_unit
        raise ValidationError({"quantity": f"Only {available} {unit} is available to dispatch after reservations."})
    transfer = StockTransfer.objects.create(
        shipment=shipment,
        source_location=source,
        destination_location=destination,
        ingredient=ingredient,
        product=product,
        quantity=quantity,
        reference=reference,
        note=note,
        recorded_by=actor,
        status=StockTransfer.Status.IN_TRANSIT,
        received_quantity=Decimal("0"),
    )
    log_activity(
        location=source,
        actor=actor,
        action="transfer_dispatched",
        summary=f"Dispatched transfer #{transfer.pk} to {destination.name}.",
        target_type="stock_transfer",
        target_id=transfer.pk,
    )
    return transfer


@transaction.atomic
def dispatch_transfer_shipment(
    *,
    source,
    destination,
    actor,
    items,
    reference="",
    note="",
    idempotency_key,
):
    authorize_business_actor(actor=actor, location=source, permission="transfers")
    if source.pk == destination.pk:
        raise ValidationError("Choose two different locations.")
    if not items:
        raise ValidationError({"items": "Add at least one cake to dispatch."})
    canonical_items = sorted(
        [
            {
                "ingredient": line["ingredient"].pk if line.get("ingredient") else None,
                "product": line["product"].pk if line.get("product") else None,
                "quantity": str(line["quantity"]),
            }
            for line in items
        ],
        key=lambda line: (line["ingredient"] or 0, line["product"] or 0),
    )
    if len({(line["ingredient"], line["product"]) for line in canonical_items}) != len(canonical_items):
        raise ValidationError({"items": "Each stock item can appear only once in a shipment."})
    fingerprint = _request_fingerprint(
        {
            "source": source.pk,
            "destination": destination.pk,
            "reference": reference,
            "note": note,
            "items": canonical_items,
        },
    )
    existing = TransferShipment.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different shipment."})
        return list(existing.items.select_related("source_location", "destination_location", "ingredient", "product", "recorded_by").order_by("pk"))
    try:
        with transaction.atomic():
            shipment = TransferShipment.objects.create(
                source_location=source,
                destination_location=destination,
                reference=reference,
                note=note,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                recorded_by=actor,
            )
    except IntegrityError:
        existing = TransferShipment.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None or existing.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different shipment."}) from None
        return list(existing.items.select_related("source_location", "destination_location", "ingredient", "product", "recorded_by").order_by("pk"))
    return [
        transfer_stock(
            source=source,
            destination=destination,
            actor=actor,
            ingredient=line.get("ingredient"),
            product=line.get("product"),
            quantity=line["quantity"],
            reference=reference,
            note=note,
            shipment=shipment,
        )
        for line in items
    ]


@transaction.atomic
def receive_transfer(
    *,
    transfer,
    actor,
    quantity=None,
    is_final=True,
    discrepancy_note="",
    idempotency_key=None,
):
    authorize_business_actor(actor=actor, location=transfer.destination_location, permission="transfers")
    transfer = StockTransfer.objects.select_for_update().get(pk=transfer.pk)
    fingerprint = _request_fingerprint(
        {
            "transfer": transfer.pk,
            "actor": actor.pk,
            "quantity": quantity,
            "is_final": is_final,
            "discrepancy_note": discrepancy_note,
        },
    )
    if idempotency_key:
        existing_receipt = StockTransferReceipt.objects.filter(idempotency_key=idempotency_key).first()
        if existing_receipt:
            if existing_receipt.request_fingerprint != fingerprint:
                raise ValidationError({"idempotency_key": "This key was already used for a different receipt."})
            return existing_receipt.transfer
    if transfer.status == StockTransfer.Status.RECEIVED:
        raise ValidationError("This transfer has already been fully received.")
    remaining = transfer.quantity - transfer.received_quantity
    received_now = remaining if quantity is None else Decimal(quantity)
    if received_now < 0 or received_now > remaining:
        raise ValidationError({"quantity": f"Enter a quantity from zero to {remaining}."})
    if received_now == 0 and not is_final:
        raise ValidationError({"quantity": "A partial receipt must include a positive quantity."})
    received_total = transfer.received_quantity + received_now
    final = is_final or received_total == transfer.quantity
    discrepancy = transfer.quantity - received_total if final else Decimal("0")
    if discrepancy > 0 and not discrepancy_note.strip():
        raise ValidationError({"discrepancy_note": "Explain the missing quantity before closing this transfer."})
    try:
        with transaction.atomic():
            receipt = StockTransferReceipt.objects.create(
                transfer=transfer,
                quantity=received_now,
                is_final=final,
                discrepancy_quantity=discrepancy,
                discrepancy_note=discrepancy_note,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                received_by=actor,
            )
    except IntegrityError:
        if not idempotency_key:
            raise
        existing_receipt = StockTransferReceipt.objects.filter(idempotency_key=idempotency_key).first()
        if existing_receipt is None or existing_receipt.request_fingerprint != fingerprint:
            raise ValidationError({"idempotency_key": "This key was already used for a different receipt."}) from None
        return existing_receipt.transfer
    transfer.received_quantity = received_total
    transfer.status = StockTransfer.Status.RECEIVED if final else StockTransfer.Status.PARTIALLY_RECEIVED
    transfer.received_by = actor
    transfer.received_at = timezone.now()
    transfer.save(update_fields=["received_quantity", "status", "received_by", "received_at"])
    item = {"ingredient": transfer.ingredient} if transfer.ingredient_id else {"product": transfer.product}
    reference = f"transfer:{transfer.pk}:receipt:{receipt.pk}"
    if received_now > 0:
        if not transfer.legacy_source_deducted:
            record_stock(
                location=transfer.source_location,
                quantity_delta=-received_now,
                kind=StockMovement.Kind.TRANSFER_OUT,
                actor=actor,
                reference=reference,
                note=transfer.note,
                **item,
                service_authorized=True,
            )
        record_stock(
            location=transfer.destination_location,
            quantity_delta=received_now,
            kind=StockMovement.Kind.TRANSFER_IN,
            actor=actor,
            reference=reference,
            note=transfer.note,
            **item,
            service_authorized=True,
        )
    if discrepancy > 0 and not transfer.legacy_source_deducted:
        record_stock(
            location=transfer.source_location,
            quantity_delta=-discrepancy,
            kind=StockMovement.Kind.TRANSFER_LOSS,
            actor=actor,
            reference=reference,
            note=discrepancy_note,
            **item,
            service_authorized=True,
        )
    log_activity(
        location=transfer.destination_location,
        actor=actor,
        action="transfer_received",
        summary=(
            f"Confirmed {received_now} of {transfer.quantity} for transfer #{transfer.pk}."
            + (f" Discrepancy: {discrepancy_note}" if discrepancy else "")
        ),
        target_type="stock_transfer",
        target_id=transfer.pk,
    )
    return transfer
