from decimal import Decimal, ROUND_HALF_UP

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import log_activity
from apps.core.constants import round_qty
from apps.core.errors import DomainError
from apps.core.services import next_code, require_non_empty
from apps.customers.services import find_or_create_customer, get_walkin
from apps.inventory.models import MovementReason
from apps.inventory.services import (
    add_movement,
    finished_item_for,
    lock_items,
    require_stock,
    stock_qty,
)
from apps.payments.models import Payment, PaymentKind, PaymentRole
from apps.payments.services import valid_method
from apps.products.models import Product
from .models import Order, OrderItem, OrderSource, OrderStatus, OrderType

ORDER_STATUS_LABELS = {
    OrderStatus.INQUIRY: "Inquiry",
    OrderStatus.QUOTED: "Quoted",
    OrderStatus.CONFIRMED: "Confirmed",
    OrderStatus.IN_PRODUCTION: "In production",
    OrderStatus.READY: "Ready",
    OrderStatus.FULFILLED: "Fulfilled",
    OrderStatus.CANCELLED: "Cancelled",
}

ORDER_TYPE_LABELS = {
    OrderType.REGULAR: "Regular sale",
    OrderType.CUSTOM: "Custom cake",
    OrderType.BULK: "Bulk order",
    OrderType.ORGANIZATIONAL: "Organizational",
}

ORDER_FLOW = {
    OrderStatus.INQUIRY: [OrderStatus.QUOTED, OrderStatus.CANCELLED],
    OrderStatus.QUOTED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
    OrderStatus.IN_PRODUCTION: [OrderStatus.READY, OrderStatus.CANCELLED],
    OrderStatus.READY: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    OrderStatus.FULFILLED: [OrderStatus.CANCELLED],
    OrderStatus.CANCELLED: [],
}


def order_total_cents(order) -> int:
    return int(order_total_decimal(order).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def order_total_decimal(order) -> Decimal:
    total = Decimal("0")
    for line in order.items.all():
        total += Decimal(line.quantity) * Decimal(line.unit_price_cents)
    return total


def create_sale(
    *,
    items,
    location: str,
    method: str,
    customer_id=None,
    actor,
    idempotency_key: str | None = None,
):
    if not items:
        raise DomainError("Add at least one product to the sale.")
    valid_method(method)

    if idempotency_key:
        existing = (
            Order.objects.filter(idempotency_key=idempotency_key)
            .prefetch_related("items")
            .first()
        )
        if existing:
            payment = Payment.objects.filter(order=existing).first()
            return existing, payment

    try:
        with transaction.atomic():
            if idempotency_key:
                existing = (
                    Order.objects.select_for_update()
                    .filter(idempotency_key=idempotency_key)
                    .prefetch_related("items")
                    .first()
                )
                if existing:
                    payment = Payment.objects.filter(order=existing).first()
                    return existing, payment

            customer = None
            if customer_id:
                from apps.customers.models import Customer

                customer = Customer.objects.filter(pk=customer_id).first()
                if customer is None:
                    raise DomainError("Select a valid customer or use the walk-in record.")
            else:
                customer = get_walkin()

            seen = set()
            resolved = []
            for line in items:
                product_id = str(line["productId"])
                if product_id in seen:
                    raise DomainError("A product can only appear once in the cart.")
                seen.add(product_id)
                product = Product.objects.filter(pk=product_id).first()
                if product is None:
                    raise DomainError("A selected product no longer exists.")
                if not product.is_available:
                    raise DomainError(f"{product.name} is marked unavailable.")
                quantity = round_qty(line["quantity"])
                if quantity <= 0:
                    raise DomainError(f"Quantity for {product.name} must be greater than zero.")
                item = finished_item_for(product)
                if item is None:
                    raise DomainError(f"{product.name} has no finished-goods record.")
                resolved.append((product, quantity, item))

            locked = lock_items([item.id for _, _, item in resolved])
            for product, quantity, item in resolved:
                require_stock(locked[str(item.id)], location, quantity, product.name)

            total_cents = sum(
                int((quantity * product.price_cents).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
                for product, quantity, _ in resolved
            )
            if total_cents <= 0:
                raise DomainError("The sale total must be greater than zero.")

            order = Order.objects.create(
                code=next_code("pos"),
                type=OrderType.REGULAR,
                status=OrderStatus.FULFILLED,
                source=OrderSource.POS,
                customer=customer,
                location=location,
                created_by=actor,
                idempotency_key=idempotency_key or None,
            )
            for product, quantity, item in resolved:
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    description=product.name,
                    quantity=quantity,
                    unit_price_cents=product.price_cents,
                )
                add_movement(
                    locked[str(item.id)],
                    location,
                    -quantity,
                    MovementReason.SALE,
                    ref_id=order.id,
                    note=f"POS sale {order.code}",
                    actor=actor,
                )

            payment = Payment.objects.create(
                order=order,
                customer=customer,
                kind=PaymentKind.PAYMENT,
                role=PaymentRole.FINAL,
                method=method,
                amount_cents=total_cents,
                location=location,
                created_by=actor,
            )
            log_activity(
                f"{order.code} recorded at {'the Café' if location == 'cafe' else 'the Home Bakery'} "
                "— stock deducted once at sale.",
                actor=actor,
            )
            order = Order.objects.prefetch_related("items").get(pk=order.pk)
            return order, payment
    except IntegrityError:
        if idempotency_key:
            existing = (
                Order.objects.filter(idempotency_key=idempotency_key)
                .prefetch_related("items")
                .first()
            )
            if existing:
                return existing, Payment.objects.filter(order=existing).first()
        raise DomainError("The sale could not be completed. Please retry.")


def create_inquiry(
    *,
    contact,
    order_type: str,
    description: str,
    delivery_date=None,
    occasion: str = "",
    servings: str = "",
    budget: str = "",
    notes: str = "",
):
    name = require_non_empty(contact.get("name"), "Please provide a contact name.")
    description = require_non_empty(description, "Please describe the cake you need.")
    phone = (contact.get("phone") or "").strip()
    email = (contact.get("email") or "").strip()
    if not phone and not email:
        raise DomainError("Please provide a phone number or email address so the bakery can respond.")
    if order_type not in {OrderType.CUSTOM, OrderType.ORGANIZATIONAL, OrderType.BULK}:
        raise DomainError("Select a valid enquiry type.")

    composed_notes = "\n".join(
        part
        for part in [
            f"Occasion: {occasion.strip()}" if occasion and occasion.strip() else "",
            f"Servings: {servings.strip()}" if servings and servings.strip() else "",
            f"Budget guide: {budget.strip()}" if budget and budget.strip() else "",
            notes.strip() if notes and notes.strip() else "",
        ]
        if part
    )

    with transaction.atomic():
        customer = find_or_create_customer(
            kind=contact.get("kind") or "individual",
            name=name,
            organization=contact.get("organization", ""),
            email=email,
            phone=phone,
            notes="Created from a public custom-order enquiry.",
        )
        order = Order.objects.create(
            code=next_code("inquiry"),
            type=order_type,
            status=OrderStatus.INQUIRY,
            source=OrderSource.WEBSITE,
            customer=customer,
            location="home_bakery",
            delivery_date=delivery_date or None,
            notes=composed_notes,
        )
        OrderItem.objects.create(
            order=order,
            description=description,
            quantity=Decimal("1"),
            unit_price_cents=0,
        )
        log_activity(
            f"Website enquiry {order.code} received from {customer.name}.", actor="Website"
        )
        return Order.objects.prefetch_related("items").get(pk=order.pk)


def create_order(
    *,
    order_type: str,
    customer_id,
    items,
    location: str,
    status: str,
    delivery_location: str = "",
    delivery_date=None,
    notes: str = "",
    source: str = OrderSource.BMS,
    actor,
):
    if not items:
        raise DomainError("Add at least one order line.")
    if status not in {OrderStatus.QUOTED, OrderStatus.CONFIRMED}:
        raise DomainError("Orders must start as quoted or confirmed.")
    from apps.customers.models import Customer

    customer = Customer.objects.filter(pk=customer_id).first()
    if customer is None:
        raise DomainError("Select a valid customer.")

    prepared = []
    for index, line in enumerate(items, start=1):
        description = require_non_empty(line.get("description"), f"Line {index}: a description is required.")
        quantity = round_qty(line.get("quantity"))
        if quantity <= 0:
            raise DomainError(f"Line {index}: quantity must be greater than zero.")
        price = line.get("unitPriceCents")
        if not isinstance(price, int) or price < 0:
            raise DomainError(f"Line {index}: price is invalid.")
        product = None
        if line.get("productId"):
            product = Product.objects.filter(pk=line["productId"]).first()
            if product is None:
                raise DomainError(f"Line {index}: the selected product no longer exists.")
        prepared.append((description, quantity, price, product))

    total = sum(int((qty * price).quantize(Decimal("1"), rounding=ROUND_HALF_UP)) for _, qty, price, _ in prepared)
    if total <= 0:
        raise DomainError("The order total must be greater than zero.")

    with transaction.atomic():
        order = Order.objects.create(
            code=next_code("order"),
            type=order_type,
            status=status,
            source=source,
            customer=customer,
            location=location,
            delivery_location=delivery_location or "",
            delivery_date=delivery_date or None,
            notes=(notes or "").strip(),
            created_by=actor,
        )
        for description, quantity, price, product in prepared:
            OrderItem.objects.create(
                order=order,
                product=product,
                description=description,
                quantity=quantity,
                unit_price_cents=price,
            )
        log_activity(
            f"{order.code} created ({ORDER_TYPE_LABELS.get(order.type, order.type)}) for {customer.name}.",
            actor=actor,
        )
    return Order.objects.prefetch_related("items").get(pk=order.pk)


def save_quotation(*, order_id, items, delivery_date=None, notes: str = "", actor):
    if not items:
        raise DomainError("Add at least one quotation line.")
    prepared = []
    for index, line in enumerate(items, start=1):
        description = require_non_empty(line.get("description"), f"Line {index}: a description is required.")
        quantity = round_qty(line.get("quantity"))
        if quantity <= 0:
            raise DomainError(f"Line {index}: quantity must be greater than zero.")
        price = line.get("unitPriceCents")
        if not isinstance(price, int) or price < 0:
            raise DomainError(f"Line {index}: price is invalid.")
        product = None
        if line.get("productId"):
            product = Product.objects.filter(pk=line["productId"]).first()
        prepared.append((description, quantity, price, product))

    total = sum(int((qty * price).quantize(Decimal("1"), rounding=ROUND_HALF_UP)) for _, qty, price, _ in prepared)
    if total <= 0:
        raise DomainError("The quotation total must be greater than zero.")

    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=order_id)
        except Order.DoesNotExist:
            raise DomainError("Order not found.")
        if order.status not in {OrderStatus.INQUIRY, OrderStatus.QUOTED}:
            raise DomainError("Quotations can only be prepared for enquiries and quoted orders.")
        order.items.all().delete()
        for description, quantity, price, product in prepared:
            OrderItem.objects.create(
                order=order,
                product=product,
                description=description,
                quantity=quantity,
                unit_price_cents=price,
            )
        order.delivery_date = delivery_date or order.delivery_date
        order.notes = (notes or "").strip() or order.notes
        order.status = OrderStatus.QUOTED
        order.save(update_fields=["delivery_date", "notes", "status", "updated_at"])
        log_activity(f"Quotation prepared for {order.code}.", actor=actor)
    return Order.objects.prefetch_related("items").get(pk=order.pk)


def _product_quantities(order) -> dict:
    quantities: dict[str, Decimal] = {}
    for line in order.items.all():
        if line.product_id and line.quantity > 0:
            key = str(line.product_id)
            quantities[key] = quantities.get(key, Decimal("0")) + Decimal(line.quantity)
    return quantities


def deduct_fulfilment_stock(order, actor) -> None:
    from apps.inventory.models import StockMovement

    if StockMovement.objects.filter(ref_id=order.id, reason=MovementReason.SALE).exists():
        return
    quantities = _product_quantities(order)
    if not quantities:
        return
    products = {str(product.id): product for product in Product.objects.filter(pk__in=quantities)}
    items = {}
    for product_id in quantities:
        product = products.get(product_id)
        if product is None:
            raise DomainError("A product on this order no longer exists.")
        item = finished_item_for(product)
        if item is None:
            raise DomainError(f"{product.name} has no finished-goods record.")
        items[product_id] = item
    locked = lock_items([item.id for item in items.values()])
    for product_id, quantity in quantities.items():
        product = products[product_id]
        item = locked[str(items[product_id].id)]
        require_stock(item, order.location, quantity, product.name)
    for product_id, quantity in quantities.items():
        item = locked[str(items[product_id].id)]
        add_movement(
            item,
            order.location,
            -quantity,
            MovementReason.SALE,
            ref_id=order.id,
            note=f"Fulfilment of {order.code}",
            actor=actor,
        )


def reverse_stock_for_order(order, actor) -> None:
    from apps.inventory.models import StockMovement

    sale_movements = list(
        StockMovement.objects.filter(ref_id=order.id, reason=MovementReason.SALE)
    )
    if not sale_movements:
        return
    if StockMovement.objects.filter(ref_id=order.id, reason=MovementReason.RETURN).exists():
        return
    locked = lock_items([movement.item_id for movement in sale_movements])
    for movement in sale_movements:
        add_movement(
            locked[str(movement.item_id)],
            movement.location,
            -movement.quantity_delta,
            MovementReason.RETURN,
            ref_id=order.id,
            note=f"Stock reversal for cancelled {order.code}",
            actor=actor,
        )


def transition_order(*, order_id, next_status: str, actor):
    from apps.production.models import BatchStatus, ProductionBatch

    if next_status not in dict(OrderStatus.choices):
        raise DomainError("Unknown order status.")
    with transaction.atomic():
        try:
            order = (
                Order.objects.select_for_update()
                .prefetch_related("items")
                .get(pk=order_id)
            )
        except Order.DoesNotExist:
            raise DomainError("Order not found.")
        if next_status not in ORDER_FLOW.get(order.status, []):
            raise DomainError(
                f"{order.code} cannot move from {ORDER_STATUS_LABELS[order.status]} "
                f"to {ORDER_STATUS_LABELS[next_status]}."
            )
        if next_status == OrderStatus.QUOTED:
            if order_total_cents(order) <= 0:
                raise DomainError("Prepare a quotation with a value before marking it quoted.")
        if next_status == OrderStatus.FULFILLED:
            deduct_fulfilment_stock(order, actor)
        if next_status == OrderStatus.CANCELLED:
            reverse_stock_for_order(order, actor)
            ProductionBatch.objects.filter(order=order).exclude(
                status__in=[
                    BatchStatus.COMPLETED,
                    BatchStatus.READY,
                    BatchStatus.CANCELLED,
                ]
            ).update(status=BatchStatus.CANCELLED, updated_at=timezone.now())
        order.status = next_status
        order.save(update_fields=["status", "updated_at"])
        log_activity(
            f"{order.code} moved to {ORDER_STATUS_LABELS[next_status]}.", actor=actor
        )
    return Order.objects.prefetch_related("items").get(pk=order.pk)


def cancel_order(*, order_id, actor):
    return transition_order(order_id=order_id, next_status=OrderStatus.CANCELLED, actor=actor)


def available_product_stock(product_id, location: str) -> Decimal:
    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return Decimal("0")
    item = finished_item_for(product)
    if not item:
        return Decimal("0")
    return stock_qty(item.id, location)
