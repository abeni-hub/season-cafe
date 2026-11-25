import pytest

from apps.inventory.models import InventoryItem, StockMovement
from apps.inventory.services import stock_qty
from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder
from apps.suppliers.models import Supplier

pytestmark = pytest.mark.django_db


def stock(sku, location="home_bakery"):
    item = InventoryItem.objects.get(sku=sku)
    return float(stock_qty(item.id, location))


def test_purchase_order_only_increases_stock_when_received(seeded, api, login):
    login("inventory@seasonscake.demo")
    supplier = Supplier.objects.get(name="Aurora Milling (demo)")
    flour = InventoryItem.objects.get(sku="RM-001")
    before = stock("RM-001")
    assert before == 80

    created = api.post(
        "/api/v1/purchase-orders/",
        {
            "supplierId": str(supplier.id),
            "lines": [
                {
                    "itemId": str(flour.id),
                    "quantity": "20",
                    "unitCostCents": 200000,
                }
            ],
            "expectedAt": "2026-12-01",
            "notes": "Test order",
        },
        format="json",
    )
    assert created.status_code == 201
    po = created.data
    assert po["status"] == "ordered"
    assert stock("RM-001") == before
    assert not StockMovement.objects.filter(
        reason="purchase_receipt", ref_id=po["id"]
    ).exists()

    partial = api.post(
        f"/api/v1/purchase-orders/{po['id']}/receive/",
        {
            "location": "home_bakery",
            "lines": [{"itemId": str(flour.id), "quantity": "10"}],
        },
        format="json",
    )
    assert partial.status_code == 201
    assert stock("RM-001") == 90
    order = PurchaseOrder.objects.get(pk=po["id"])
    assert order.status == "partially_received"
    flour.refresh_from_db()
    assert flour.cost_per_unit_cents == 128889

    over = api.post(
        f"/api/v1/purchase-orders/{po['id']}/receive/",
        {
            "location": "home_bakery",
            "lines": [{"itemId": str(flour.id), "quantity": "15"}],
        },
        format="json",
    )
    assert over.status_code == 400
    assert "only" in over.data["detail"].lower()

    final = api.post(
        f"/api/v1/purchase-orders/{po['id']}/receive/",
        {
            "location": "home_bakery",
            "lines": [{"itemId": str(flour.id), "quantity": "10"}],
        },
        format="json",
    )
    assert final.status_code == 201
    order.refresh_from_db()
    assert order.status == "received"
    assert stock("RM-001") == 100
    assert StockMovement.objects.filter(
        reason="purchase_receipt", ref_id=order.id
    ).count() == 2

    again = api.post(
        f"/api/v1/purchase-orders/{po['id']}/receive/",
        {"location": "home_bakery", "lines": [{"itemId": str(flour.id), "quantity": "1"}]},
        format="json",
    )
    assert again.status_code == 400
    assert api.post(f"/api/v1/purchase-orders/{po['id']}/cancel/").status_code == 400


def test_purchase_order_rejects_duplicates_and_finished_goods(seeded, api, login):
    login("inventory@seasonscake.demo")
    supplier = Supplier.objects.get(name="Aurora Milling (demo)")
    flour = InventoryItem.objects.get(sku="RM-001")
    sugar = InventoryItem.objects.get(sku="RM-002")
    finished = InventoryItem.objects.filter(
        product=Product.objects.get(slug="vanilla-custard")
    ).first()

    duplicate = api.post(
        "/api/v1/purchase-orders/",
        {
            "supplierId": str(supplier.id),
            "lines": [
                {"itemId": str(flour.id), "quantity": "5", "unitCostCents": 100000},
                {"itemId": str(flour.id), "quantity": "5", "unitCostCents": 100000},
            ],
        },
        format="json",
    )
    assert duplicate.status_code == 400
    assert "once" in duplicate.data["detail"].lower()

    finished_line = api.post(
        "/api/v1/purchase-orders/",
        {
            "supplierId": str(supplier.id),
            "lines": [
                {"itemId": str(finished.id), "quantity": "5", "unitCostCents": 100000}
            ],
        },
        format="json",
    )
    assert finished_line.status_code == 400
    assert "produced" in finished_line.data["detail"].lower()

    valid = api.post(
        "/api/v1/purchase-orders/",
        {
            "supplierId": str(supplier.id),
            "lines": [
                {"itemId": str(sugar.id), "quantity": "1", "unitCostCents": 150000}
            ],
        },
        format="json",
    )
    assert valid.status_code == 201


def test_supplier_balances_and_payments(seeded, api, login):
    login("inventory@seasonscake.demo")
    response = api.get("/api/v1/supplier-balances/")
    assert response.status_code == 200
    green = next(row for row in response.data if row["name"] == "Green Valley Demo Supplies")
    assert green["receivedCents"] == 13150000
    assert green["paidCents"] == 5000000
    assert green["balanceCents"] == 8150000

    supplier = Supplier.objects.get(name="Green Valley Demo Supplies")
    payment = api.post(
        "/api/v1/supplier-payments/",
        {
            "supplierId": str(supplier.id),
            "amountCents": 1150000,
            "method": "transfer",
            "note": "Balance settlement",
        },
        format="json",
    )
    assert payment.status_code == 201
    after = api.get("/api/v1/supplier-balances/").data
    green = next(row for row in after if row["name"] == "Green Valley Demo Supplies")
    assert green["balanceCents"] == 7000000
