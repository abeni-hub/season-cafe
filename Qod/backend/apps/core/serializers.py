"""Camel-cased output builders shared by REST responses and the bootstrap payload.

The React application already speaks this exact shape (see src/types/domain.ts), so
keeping one serializer layer avoids contract drift between endpoints and hydration.
"""

from apps.accounts.permissions import permissions_for


def _iso(value):
    if value is None:
        return None
    text = value.isoformat()
    return text.replace("+00:00", "Z")


def _date(value):
    return value.isoformat() if value else None


def _num(value):
    return float(value)


def _add(target: dict, key: str, value):
    if value not in (None, ""):
        target[key] = value


def product_dict(product) -> dict:
    return {
        "id": str(product.id),
        "name": product.name,
        "slug": product.slug,
        "tagline": product.tagline,
        "description": product.description,
        "priceCents": product.price_cents,
        "isPublished": product.is_published,
        "isAvailable": product.is_available,
        "artIndex": product.art_index,
        "sortOrder": product.sort_order,
    }


def customer_dict(customer) -> dict:
    payload = {
        "id": str(customer.id),
        "kind": customer.kind,
        "name": customer.name,
        "createdAt": _iso(customer.created_at),
    }
    _add(payload, "organization", customer.organization)
    _add(payload, "phone", customer.phone)
    _add(payload, "email", customer.email)
    _add(payload, "address", customer.address)
    _add(payload, "notes", customer.notes)
    if customer.is_walkin:
        payload["isWalkIn"] = True
    return payload


def order_item_dict(item) -> dict:
    payload = {
        "id": str(item.id),
        "description": item.description,
        "quantity": _num(item.quantity),
        "unitPriceCents": item.unit_price_cents,
    }
    if item.product_id:
        payload["productId"] = str(item.product_id)
    return payload


def order_dict(order) -> dict:
    payload = {
        "id": str(order.id),
        "code": order.code,
        "type": order.type,
        "status": order.status,
        "source": order.source,
        "customerId": str(order.customer_id),
        "items": [order_item_dict(item) for item in order.items.all()],
        "location": order.location,
        "createdAt": _iso(order.created_at),
        "updatedAt": _iso(order.updated_at),
    }
    _add(payload, "deliveryLocation", order.delivery_location)
    _add(payload, "deliveryDate", _date(order.delivery_date))
    _add(payload, "notes", order.notes)
    return payload


def payment_dict(payment) -> dict:
    payload = {
        "id": str(payment.id),
        "orderId": str(payment.order_id),
        "customerId": str(payment.customer_id),
        "kind": payment.kind,
        "role": payment.role,
        "method": payment.method,
        "amountCents": payment.amount_cents,
        "location": payment.location,
        "createdAt": _iso(payment.created_at),
    }
    _add(payload, "note", payment.note)
    return payload


def inventory_item_dict(item) -> dict:
    payload = {
        "id": str(item.id),
        "sku": item.sku,
        "name": item.name,
        "kind": item.kind,
        "unit": item.unit,
        "costPerUnitCents": item.cost_per_unit_cents,
        "reorderLevel": _num(item.reorder_level),
    }
    if item.product_id:
        payload["productId"] = str(item.product_id)
    return payload


def stock_level_dict(item_id: str, location: str, quantity) -> dict:
    return {
        "itemId": str(item_id),
        "location": location,
        "quantity": _num(quantity),
    }


def movement_dict(movement) -> dict:
    payload = {
        "id": str(movement.id),
        "itemId": str(movement.item_id),
        "location": movement.location,
        "quantityDelta": _num(movement.quantity_delta),
        "reason": movement.reason,
        "createdAt": _iso(movement.created_at),
        "createdBy": movement.created_by_label,
    }
    if movement.ref_id:
        payload["refId"] = str(movement.ref_id)
    _add(payload, "note", movement.note)
    return payload


def supplier_dict(supplier) -> dict:
    payload = {
        "id": str(supplier.id),
        "name": supplier.name,
        "createdAt": _iso(supplier.created_at),
    }
    _add(payload, "contactName", supplier.contact_name)
    _add(payload, "phone", supplier.phone)
    _add(payload, "email", supplier.email)
    _add(payload, "notes", supplier.notes)
    return payload


def purchase_order_dict(order) -> dict:
    payload = {
        "id": str(order.id),
        "code": order.code,
        "supplierId": str(order.supplier_id),
        "status": order.status,
        "lines": [
            {
                "itemId": str(line.item_id),
                "quantity": _num(line.quantity),
                "unitCostCents": line.unit_cost_cents,
            }
            for line in order.lines.all()
        ],
        "createdAt": _iso(order.created_at),
    }
    _add(payload, "expectedAt", _date(order.expected_at))
    _add(payload, "notes", order.notes)
    return payload


def purchase_receipt_dict(receipt) -> dict:
    return {
        "id": str(receipt.id),
        "purchaseOrderId": str(receipt.purchase_order_id),
        "supplierId": str(receipt.supplier_id),
        "location": receipt.location,
        "lines": [
            {
                "itemId": str(line.item_id),
                "quantity": _num(line.quantity),
                "unitCostCents": line.unit_cost_cents,
            }
            for line in receipt.lines.all()
        ],
        "receivedAt": _iso(receipt.received_at),
        "receivedBy": receipt.received_by_label,
    }


def supplier_payment_dict(payment) -> dict:
    payload = {
        "id": str(payment.id),
        "supplierId": str(payment.supplier_id),
        "amountCents": payment.amount_cents,
        "method": payment.method,
        "createdAt": _iso(payment.created_at),
    }
    _add(payload, "note", payment.note)
    return payload


def recipe_dict(recipe) -> dict:
    payload = {
        "id": str(recipe.id),
        "productId": str(recipe.product_id),
        "yieldQuantity": _num(recipe.yield_quantity),
        "lines": [
            {"itemId": str(line.item_id), "quantity": _num(line.quantity)}
            for line in recipe.lines.all()
        ],
        "updatedAt": _iso(recipe.updated_at),
    }
    _add(payload, "notes", recipe.notes)
    return payload


def batch_dict(batch) -> dict:
    payload = {
        "id": str(batch.id),
        "code": batch.code,
        "title": batch.title,
        "quantity": _num(batch.quantity),
        "location": batch.location,
        "status": batch.status,
        "createdAt": _iso(batch.created_at),
    }
    _add(payload, "productId", str(batch.product_id) if batch.product_id else None)
    _add(payload, "recipeId", str(batch.recipe_id) if batch.recipe_id else None)
    _add(payload, "orderId", str(batch.order_id) if batch.order_id else None)
    _add(
        payload,
        "assignedEmployeeId",
        str(batch.assigned_employee_id) if batch.assigned_employee_id else None,
    )
    _add(payload, "scheduledFor", _iso(batch.scheduled_for))
    _add(payload, "startedAt", _iso(batch.started_at))
    _add(payload, "completedAt", _iso(batch.completed_at))
    _add(payload, "qualityNote", batch.quality_note)
    _add(payload, "notes", batch.notes)
    return payload


def transfer_dict(transfer) -> dict:
    payload = {
        "id": str(transfer.id),
        "code": transfer.code,
        "from": transfer.from_location,
        "to": transfer.to_location,
        "lines": [
            {"itemId": str(line.item_id), "quantity": _num(line.quantity)}
            for line in transfer.lines.all()
        ],
        "status": transfer.status,
        "createdAt": _iso(transfer.created_at),
    }
    _add(payload, "notes", transfer.notes)
    _add(payload, "dispatchedAt", _iso(transfer.dispatched_at))
    _add(payload, "receivedAt", _iso(transfer.received_at))
    return payload


def expense_dict(expense) -> dict:
    return {
        "id": str(expense.id),
        "category": expense.category,
        "amountCents": expense.amount_cents,
        "location": expense.location,
        "note": expense.note,
        "incurredAt": _date(expense.incurred_at),
        "recordedBy": expense.recorded_by_label,
    }


def employee_dict(user) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "password": "",
        "role": user.role,
        "isActive": user.is_active,
        "createdAt": _iso(user.date_joined),
    }


def message_dict(message) -> dict:
    payload = {
        "id": str(message.id),
        "name": message.name,
        "subject": message.subject,
        "body": message.body,
        "isRead": message.is_read,
        "createdAt": _iso(message.created_at),
    }
    _add(payload, "email", message.email)
    _add(payload, "phone", message.phone)
    return payload


def activity_dict(activity) -> dict:
    return {
        "id": str(activity.id),
        "message": activity.message,
        "actor": activity.actor_label,
        "createdAt": _iso(activity.created_at),
    }


def site_content_dict(content) -> dict:
    return {
        "heroEyebrow": content.hero_eyebrow,
        "heroTitle": content.hero_title,
        "heroLead": content.hero_lead,
        "aboutTitle": content.about_title,
        "aboutLead": content.about_lead,
        "aboutBody": content.about_body,
        "customOrderNote": content.custom_order_note,
        "contactPhone": content.contact_phone,
        "contactEmail": content.contact_email,
        "contactAddress": content.contact_address,
        "openingHours": content.opening_hours,
        "galleryCaptions": content.gallery_captions,
    }


def settings_dict(settings) -> dict:
    return {
        "businessName": settings.business_name,
        "currency": settings.currency,
        "tagline": settings.tagline,
        "locations": [
            {"id": "home_bakery", "name": "Home Bakery", "kind": "Production & collection"},
            {"id": "cafe", "name": "Café", "kind": "Retail counter"},
        ],
    }


def user_dict(user) -> dict:
    return {
        "employeeId": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "isActive": user.is_active,
        "permissions": sorted(permissions_for(user)),
    }
