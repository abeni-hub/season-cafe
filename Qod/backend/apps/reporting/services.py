from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.utils import timezone

from apps.audit.models import Activity
from apps.customers.models import Customer
from apps.expenses.models import Expense
from apps.inventory.models import InventoryItem
from apps.inventory.services import stock_positions
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment
from apps.production.models import BatchStatus, ProductionBatch

OPEN_STATUSES = [
    OrderStatus.INQUIRY,
    OrderStatus.QUOTED,
    OrderStatus.CONFIRMED,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.READY,
]
ACTIVE_BATCH_STATUSES = [
    BatchStatus.PENDING,
    BatchStatus.SCHEDULED,
    BatchStatus.IN_PRODUCTION,
    BatchStatus.QUALITY_CHECK,
]


def _order_balance(order) -> int:
    total = sum(
        int((Decimal(line.quantity) * line.unit_price_cents).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        for line in order.items.all()
    )
    paid = sum(
        payment.amount_cents for payment in order.payments.all() if payment.kind == "payment"
    )
    refunded = sum(
        payment.amount_cents for payment in order.payments.all() if payment.kind == "refund"
    )
    return max(0, total - (paid - refunded))


def _start_of_day(days_back: int = 0):
    day = timezone.localdate() - timedelta(days=days_back)
    return timezone.make_aware(
        datetime.combine(day, time.min), timezone.get_current_timezone()
    )


def dashboard_summary() -> dict:
    today = _start_of_day(0)
    month = _start_of_day(29)
    payments = Payment.objects.all()
    # Net collected = payments minus refunds.
    collected_today = 0
    for payment in payments.filter(created_at__gte=today):
        collected_today += payment.amount_cents if payment.kind == "payment" else -payment.amount_cents
    collected_30 = 0
    for payment in payments.filter(created_at__gte=month):
        collected_30 += payment.amount_cents if payment.kind == "payment" else -payment.amount_cents

    live_orders = list(
        Order.objects.exclude(status=OrderStatus.CANCELLED).prefetch_related("items", "payments")
    )
    outstanding = sum(_order_balance(order) for order in live_orders)

    positions = stock_positions()
    low_stock = 0
    for item in InventoryItem.objects.filter(is_active=True):
        total_qty = positions.get((str(item.id), "home_bakery"), Decimal("0")) + positions.get(
            (str(item.id), "cafe"), Decimal("0")
        )
        if total_qty < item.reorder_level:
            low_stock += 1

    recent_orders = (
        Order.objects.prefetch_related("items")
        .order_by("-created_at")[:6]
    )
    recent_activity = Activity.objects.all()[:7]
    return {
        "todayCollectedCents": collected_today,
        "last30CollectedCents": collected_30,
        "outstandingCents": outstanding,
        "pendingOrders": len([order for order in live_orders if order.status in OPEN_STATUSES]),
        "todayOrdersCount": Order.objects.filter(created_at__gte=today).count(),
        "activeBatches": ProductionBatch.objects.filter(
            status__in=ACTIVE_BATCH_STATUSES
        ).count(),
        "lowStockCount": low_stock,
        "recentOrders": recent_orders,
        "recentActivity": recent_activity,
    }


def sales_series(days: int) -> list[dict]:
    days = max(1, min(int(days), 90))
    start_day = timezone.localdate() - timedelta(days=days - 1)
    start = _start_of_day(days - 1)
    buckets = {
        (start_day + timedelta(days=offset)): {"collected": 0, "orders": 0}
        for offset in range(days)
    }
    for payment in Payment.objects.filter(created_at__gte=start):
        day = timezone.localtime(payment.created_at).date()
        if day in buckets:
            buckets[day]["collected"] += (
                payment.amount_cents if payment.kind == "payment" else -payment.amount_cents
            )
    for order in Order.objects.filter(created_at__gte=start).exclude(status=OrderStatus.INQUIRY):
        day = timezone.localtime(order.created_at).date()
        if day in buckets:
            buckets[day]["orders"] += 1
    return [
        {
            "date": day.isoformat(),
            "label": f"{day.day} {day.strftime('%b')}",
            "collectedCents": data["collected"],
            "ordersCount": data["orders"],
        }
        for day, data in buckets.items()
    ]


def product_performance(days: int, limit: int = 7) -> list[dict]:
    days = max(1, min(int(days), 90))
    cutoff = _start_of_day(days - 1)
    rows: dict[str, dict] = {}
    orders = (
        Order.objects.filter(status=OrderStatus.FULFILLED, created_at__gte=cutoff)
        .prefetch_related("items")
    )
    for order in orders:
        for line in order.items.all():
            key = str(line.product_id) if line.product_id else line.description
            current = rows.setdefault(
                key, {"name": line.description, "quantity": Decimal("0"), "revenueCents": 0}
            )
            current["quantity"] += Decimal(line.quantity)
            current["revenueCents"] += int(
                (Decimal(line.quantity) * line.unit_price_cents).quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            )
    ordered = sorted(rows.values(), key=lambda row: row["revenueCents"], reverse=True)[:limit]
    return [
        {
            "name": row["name"],
            "quantity": float(row["quantity"]),
            "revenueCents": row["revenueCents"],
        }
        for row in ordered
    ]


def expenses_by_category(days: int) -> list[dict]:
    days = max(1, min(int(days), 365))
    cutoff = timezone.localdate() - timedelta(days=days - 1)
    totals: dict[str, int] = {}
    for expense in Expense.objects.filter(incurred_at__gte=cutoff):
        totals[expense.category] = totals.get(expense.category, 0) + expense.amount_cents
    return [
        {"category": category, "totalCents": total}
        for category, total in sorted(totals.items(), key=lambda entry: entry[1], reverse=True)
    ]


def total_expenses(days: int) -> int:
    days = max(1, min(int(days), 365))
    cutoff = timezone.localdate() - timedelta(days=days - 1)
    return (
        Expense.objects.filter(incurred_at__gte=cutoff).aggregate(total=Sum("amount_cents"))[
            "total"
        ]
        or 0
    )


def inventory_valuation() -> dict:
    positions = stock_positions()
    rows = []
    for item in InventoryItem.objects.all():
        home = positions.get((str(item.id), "home_bakery"), Decimal("0"))
        cafe = positions.get((str(item.id), "cafe"), Decimal("0"))
        total = home + cafe
        rows.append(
            {
                "itemId": str(item.id),
                "name": item.name,
                "kind": item.kind,
                "unit": item.unit,
                "homeBakery": float(home),
                "cafe": float(cafe),
                "total": float(total),
                "costPerUnitCents": item.cost_per_unit_cents,
                "valueCents": int(
                    (total * item.cost_per_unit_cents).quantize(
                        Decimal("1"), rounding=ROUND_HALF_UP
                    )
                ),
            }
        )
    rows.sort(key=lambda row: row["valueCents"], reverse=True)
    return {"rows": rows, "totalCents": sum(row["valueCents"] for row in rows)}


def customer_balances() -> list[dict]:
    rows = []
    customers = Customer.objects.filter(is_walkin=False).prefetch_related(
        "orders__items", "orders__payments"
    )
    for customer in customers:
        live = [order for order in customer.orders.all() if order.status != OrderStatus.CANCELLED]
        balance = sum(_order_balance(order) for order in live)
        if balance <= 0:
            continue
        rows.append(
            {
                "customerId": str(customer.id),
                "name": customer.name,
                "kind": customer.kind,
                "openOrders": len([order for order in live if order.status != OrderStatus.FULFILLED]),
                "balanceCents": balance,
            }
        )
    rows.sort(key=lambda row: row["balanceCents"], reverse=True)
    return rows
