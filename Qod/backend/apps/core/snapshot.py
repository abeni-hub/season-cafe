"""Role-filtered bootstrap payload used to hydrate the React store."""

from apps.accounts.models import User
from apps.accounts.permissions import permissions_for
from apps.audit.models import Activity
from apps.core.models import BusinessSettings, CodeSequence
from apps.customers.models import Customer
from apps.expenses.models import Expense
from apps.inventory.models import InventoryItem, StockMovement
from apps.inventory.services import stock_positions
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.production.models import ProductionBatch
from apps.products.models import Product
from apps.purchasing.models import (
    PurchaseOrder,
    PurchaseReceipt,
    SupplierPayment,
)
from apps.recipes.models import Recipe
from apps.suppliers.models import Supplier
from apps.transfers.models import Transfer
from apps.website.models import Message, SiteContent
from .serializers import (
    activity_dict,
    batch_dict,
    customer_dict,
    employee_dict,
    expense_dict,
    inventory_item_dict,
    message_dict,
    movement_dict,
    order_dict,
    payment_dict,
    product_dict,
    purchase_order_dict,
    purchase_receipt_dict,
    recipe_dict,
    settings_dict,
    site_content_dict,
    stock_level_dict,
    supplier_dict,
    supplier_payment_dict,
    transfer_dict,
)

COUNTER_KEYS = ["pos", "order", "inquiry", "po", "batch", "transfer"]


def build_snapshot(user) -> dict:
    perms = permissions_for(user)
    authenticated = bool(user and getattr(user, "is_authenticated", False))

    def allow(permission: str) -> bool:
        return permission in perms

    products = Product.objects.all()
    if not authenticated:
        products = products.filter(is_published=True)

    snapshot = {
        "version": 1,
        "products": [product_dict(product) for product in products.order_by("sort_order")],
        "customers": [],
        "orders": [],
        "payments": [],
        "inventoryItems": [],
        "stock": [],
        "movements": [],
        "suppliers": [],
        "purchaseOrders": [],
        "purchaseReceipts": [],
        "supplierPayments": [],
        "recipes": [],
        "batches": [],
        "transfers": [],
        "expenses": [],
        "employees": [],
        "messages": [],
        "siteContent": site_content_dict(SiteContent.load()),
        "settings": settings_dict(BusinessSettings.load()),
        "activity": [],
        "counters": {
            row.key: row.value
            for row in CodeSequence.objects.filter(key__in=COUNTER_KEYS)
        },
    }

    if not authenticated:
        return snapshot

    if allow("orders.view") or allow("customers.manage") or allow("pos.use"):
        snapshot["customers"] = [
            customer_dict(customer) for customer in Customer.objects.all().order_by("name")
        ]

    if allow("orders.view"):
        orders = Order.objects.prefetch_related("items").order_by("-created_at")
        snapshot["orders"] = [order_dict(order) for order in orders]

    if allow("payments.view"):
        payments = Payment.objects.order_by("-created_at")
        snapshot["payments"] = [payment_dict(payment) for payment in payments]

    if allow("inventory.view") or allow("pos.use") or allow("production.view"):
        items = list(InventoryItem.objects.order_by("sku"))
        snapshot["inventoryItems"] = [inventory_item_dict(item) for item in items]
        positions = stock_positions()
        stock = []
        for item in items:
            for location in ("home_bakery", "cafe"):
                quantity = positions.get((str(item.id), location), 0)
                if quantity or (str(item.id), location) in positions:
                    stock.append(stock_level_dict(item.id, location, quantity))
        snapshot["stock"] = stock

    if allow("inventory.view"):
        movements = (
            StockMovement.objects.select_related("item").order_by("-created_at")[:500]
        )
        snapshot["movements"] = [movement_dict(movement) for movement in movements]

    if allow("purchasing.manage"):
        snapshot["suppliers"] = [
            supplier_dict(supplier) for supplier in Supplier.objects.all().order_by("name")
        ]
        snapshot["purchaseOrders"] = [
            purchase_order_dict(order)
            for order in PurchaseOrder.objects.prefetch_related("lines").order_by("-created_at")
        ]
        snapshot["purchaseReceipts"] = [
            purchase_receipt_dict(receipt)
            for receipt in PurchaseReceipt.objects.prefetch_related("lines").order_by(
                "-received_at"
            )
        ]
        snapshot["supplierPayments"] = [
            supplier_payment_dict(payment)
            for payment in SupplierPayment.objects.order_by("-created_at")
        ]

    if allow("recipes.manage") or allow("production.view"):
        snapshot["recipes"] = [
            recipe_dict(recipe)
            for recipe in Recipe.objects.prefetch_related("lines").select_related("product")
        ]

    if allow("production.view"):
        snapshot["batches"] = [
            batch_dict(batch)
            for batch in ProductionBatch.objects.order_by("-created_at")
        ]

    if allow("transfers.manage"):
        snapshot["transfers"] = [
            transfer_dict(transfer)
            for transfer in Transfer.objects.prefetch_related("lines").order_by("-created_at")
        ]

    if allow("finance.view") or allow("expenses.manage") or allow("reports.view"):
        snapshot["expenses"] = [
            expense_dict(expense) for expense in Expense.objects.order_by("-incurred_at", "-created_at")
        ]

    if allow("employees.manage"):
        snapshot["employees"] = [
            employee_dict(employee) for employee in User.objects.all().order_by("name")
        ]

    if allow("cms.manage"):
        snapshot["messages"] = [
            message_dict(message) for message in Message.objects.order_by("-created_at")
        ]

    if allow("dashboard.view"):
        snapshot["activity"] = [
            activity_dict(entry) for entry in Activity.objects.order_by("-created_at")[:200]
        ]

    return snapshot
