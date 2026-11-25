import pytest

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem, StockMovement
from apps.inventory.services import stock_qty
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.products.models import Product

pytestmark = pytest.mark.django_db


def stock(sku, location="home_bakery"):
    item = InventoryItem.objects.get(sku=sku)
    return float(stock_qty(item.id, location))


def product(name):
    return Product.objects.get(name=name)


def customer():
    return Customer.objects.get(organization="Brightline Demo Ltd")


def test_quotation_deposit_does_not_move_stock(seeded, api, login):
    login("manager@seasonscake.demo")
    response = api.post(
        "/api/v1/orders/create/",
        {
            "type": "custom",
            "customerId": str(customer().id),
            "items": [
                {"description": "Tasting box", "quantity": "1", "unitPriceCents": 1500000}
            ],
            "status": "quoted",
        },
        format="json",
    )
    assert response.status_code == 201
    order_id = response.data["id"]
    assert response.data["status"] == "quoted"

    payment = api.post(
        "/api/v1/payments/record/",
        {"orderId": order_id, "amountCents": 100000, "method": "transfer"},
        format="json",
    )
    assert payment.status_code == 201
    assert payment.data["role"] == "deposit"
    order = Order.objects.get(pk=order_id)
    assert order.status == "quoted"
    assert not StockMovement.objects.filter(ref_id=order_id).exists()


def test_payment_on_unpriced_inquiry_rejected(seeded, api, login):
    order = Order.objects.get(code="INQ-3001")
    login("manager@seasonscake.demo")
    response = api.post(
        "/api/v1/payments/record/",
        {"orderId": str(order.id), "amountCents": 100000, "method": "cash"},
        format="json",
    )
    assert response.status_code == 400
    assert "quotation" in response.data["detail"].lower()


def test_public_inquiry_to_quotation_to_deposit(seeded, api, login):
    inquiry = api.post(
        "/api/v1/orders/inquiries/",
        {
            "contact": {
                "name": "Ada Example",
                "phone": "08000000000",
                "email": "ada@example.test",
            },
            "type": "custom",
            "description": "Birthday cake for 20 guests",
            "occasion": "Birthday",
            "servings": "20",
            "budget": "50,000",
        },
        format="json",
    )
    assert inquiry.status_code == 201
    assert inquiry.data["status"] == "inquiry"
    order_id = inquiry.data["id"]

    login("manager@seasonscake.demo")
    quoted = api.post(
        f"/api/v1/orders/{order_id}/quotation/",
        {
            "items": [
                {
                    "description": "Two-tier birthday cake",
                    "quantity": "1",
                    "unitPriceCents": 5000000,
                }
            ],
            "notes": "Quoted after consultation.",
        },
        format="json",
    )
    assert quoted.status_code == 200
    assert quoted.data["status"] == "quoted"

    deposit = api.post(
        "/api/v1/payments/record/",
        {"orderId": order_id, "amountCents": 2000000, "method": "transfer"},
        format="json",
    )
    assert deposit.status_code == 201
    assert deposit.data["role"] == "deposit"

    detail = api.get(f"/api/v1/orders/{order_id}/")
    assert detail.data["totals"] == {
        "totalCents": 5000000,
        "paidCents": 2000000,
        "refundedCents": 0,
        "balanceCents": 3000000,
    }


def test_payment_cannot_exceed_balance_and_is_idempotent(seeded, api, login):
    login("manager@seasonscake.demo")
    order = api.post(
        "/api/v1/orders/create/",
        {
            "type": "bulk",
            "customerId": str(customer().id),
            "items": [
                {"description": "Cream puffs", "quantity": "10", "unitPriceCents": 380000}
            ],
            "status": "confirmed",
        },
        format="json",
    ).data

    over = api.post(
        "/api/v1/payments/record/",
        {"orderId": order["id"], "amountCents": 4000000, "method": "cash"},
        format="json",
    )
    assert over.status_code == 400
    assert "exceed" in over.data["detail"].lower()

    payload = {
        "orderId": order["id"],
        "amountCents": 1000000,
        "method": "cash",
        "idempotencyKey": "test-deposit-1",
    }
    first = api.post("/api/v1/payments/record/", payload, format="json")
    second = api.post("/api/v1/payments/record/", payload, format="json")
    assert first.status_code == 201 and second.status_code == 201
    assert first.data["id"] == second.data["id"]
    assert Payment.objects.filter(order_id=order["id"]).count() == 1


def test_refund_reduces_net_paid_and_cannot_exceed_it(seeded, api, login):
    login("manager@seasonscake.demo")
    order = api.post(
        "/api/v1/orders/create/",
        {
            "type": "custom",
            "customerId": str(customer().id),
            "items": [
                {"description": "Tart platter", "quantity": "1", "unitPriceCents": 900000}
            ],
            "status": "confirmed",
        },
        format="json",
    ).data
    api.post(
        "/api/v1/payments/record/",
        {"orderId": order["id"], "amountCents": 900000, "method": "card"},
        format="json",
    )
    refund = api.post(
        "/api/v1/payments/refund/",
        {"orderId": order["id"], "amountCents": 250000, "method": "card", "reason": "Goodwill"},
        format="json",
    )
    assert refund.status_code == 201
    assert refund.data["kind"] == "refund"
    detail = api.get(f"/api/v1/orders/{order['id']}/").data
    assert detail["totals"]["refundedCents"] == 250000
    assert detail["totals"]["balanceCents"] == 250000

    too_much = api.post(
        "/api/v1/payments/refund/",
        {"orderId": order["id"], "amountCents": 1000000, "method": "card"},
        format="json",
    )
    assert too_much.status_code == 400


def test_pos_sale_deducts_stock_exactly_once(seeded, api, login):
    login("cashier@seasonscake.demo")
    before = stock("FG-001", "cafe")
    payload = {
        "location": "cafe",
        "method": "cash",
        "items": [{"productId": str(product("Vanilla Custard").id), "quantity": "2"}],
        "idempotencyKey": "pos-sale-002",
    }
    first = api.post("/api/v1/pos/sales/", payload, format="json")
    assert first.status_code == 201
    second = api.post("/api/v1/pos/sales/", payload, format="json")
    assert second.status_code == 201
    assert first.data["order"]["id"] == second.data["order"]["id"]
    assert stock("FG-001", "cafe") == before - 2
    assert (
        StockMovement.objects.filter(
            reason="sale", ref_id=first.data["order"]["id"], item__sku="FG-001"
        ).count()
        == 1
    )
    assert Payment.objects.filter(order_id=first.data["order"]["id"]).count() == 1


def test_pos_sale_rejects_insufficient_stock(seeded, api, login):
    login("cashier@seasonscake.demo")
    before = stock("FG-001", "cafe")
    response = api.post(
        "/api/v1/pos/sales/",
        {
            "location": "cafe",
            "method": "cash",
            "items": [{"productId": str(product("Vanilla Custard").id), "quantity": "500"}],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "not enough" in response.data["detail"].lower()
    assert stock("FG-001", "cafe") == before


def test_fulfilment_deducts_finished_stock_once(seeded, api, login):
    login("manager@seasonscake.demo")
    vanilla = product("Mocha")
    before = stock("FG-003", "home_bakery")
    order = api.post(
        "/api/v1/orders/create/",
        {
            "type": "regular",
            "customerId": str(customer().id),
            "items": [
                {
                    "productId": str(vanilla.id),
                    "description": "Mocha",
                    "quantity": "3",
                    "unitPriceCents": 500000,
                }
            ],
            "status": "confirmed",
        },
        format="json",
    ).data

    for status in ["in_production", "ready", "fulfilled"]:
        response = api.post(
            f"/api/v1/orders/{order['id']}/transition/",
            {"status": status},
            format="json",
        )
        assert response.status_code == 200, response.content

    assert stock("FG-003", "home_bakery") == before - 3
    assert (
        StockMovement.objects.filter(
            reason="sale", ref_id=order["id"], item__sku="FG-003"
        ).count()
        == 1
    )

    again = api.post(
        f"/api/v1/orders/{order['id']}/transition/",
        {"status": "fulfilled"},
        format="json",
    )
    assert again.status_code == 400
    assert stock("FG-003", "home_bakery") == before - 3

    cancel = api.post(f"/api/v1/orders/{order['id']}/cancel/")
    assert cancel.status_code == 200
    assert cancel.data["status"] == "cancelled"
    assert stock("FG-003", "home_bakery") == before
    assert (
        api.post(f"/api/v1/orders/{order['id']}/cancel/").status_code == 400
    )
    assert stock("FG-003", "home_bakery") == before


def test_zero_value_quotation_rejected(seeded, api, login):
    login("manager@seasonscake.demo")
    response = api.post(
        "/api/v1/orders/create/",
        {
            "type": "custom",
            "customerId": str(customer().id),
            "items": [{"description": "Unpriced idea", "quantity": "1", "unitPriceCents": 0}],
            "status": "quoted",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "greater than zero" in response.data["detail"].lower()


def test_customer_balance_reflects_outstanding(seeded, api, login):
    login("manager@seasonscake.demo")
    response = api.get(f"/api/v1/customers/{customer().id}/balance/")
    assert response.status_code == 200
    # ORD-2001 (18,000,000 - 9,000,000) + ORD-2003 (7,600,000 - 3,000,000)
    assert response.data["balanceCents"] == 13600000


def test_order_list_pagination_and_filters(seeded, api, login):
    login("manager@seasonscake.demo")
    response = api.get("/api/v1/orders/?status=confirmed&page_size=1")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["code"] == "ORD-2003"

    search = api.get("/api/v1/orders/?search=POS-1007")
    assert search.status_code == 200
    assert search.data["results"][0]["id"]


def test_order_duplicate_idempotency_key_reuses_sale(seeded, api, login):
    login("cashier@seasonscake.demo")
    payload = {
        "location": "cafe",
        "method": "cash",
        "items": [{"productId": str(product("Mocha").id), "quantity": "1"}],
        "idempotencyKey": "pos-dup-key",
    }
    first = api.post("/api/v1/pos/sales/", payload, format="json")
    second = api.post("/api/v1/pos/sales/", payload, format="json")
    assert first.status_code == 201 and second.status_code == 201
    assert first.data["order"]["id"] == second.data["order"]["id"]
    assert Order.objects.filter(idempotency_key="pos-dup-key").count() == 1
