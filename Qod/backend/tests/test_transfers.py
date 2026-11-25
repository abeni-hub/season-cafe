import pytest

from apps.inventory.models import InventoryItem, StockMovement
from apps.inventory.services import stock_qty
from apps.transfers.models import Transfer

pytestmark = pytest.mark.django_db


def stock(sku, location):
    item = InventoryItem.objects.get(sku=sku)
    return float(stock_qty(item.id, location))


def transfer_payload(item, quantity="5"):
    return {
        "from": "home_bakery",
        "to": "cafe",
        "lines": [{"itemId": str(item.id), "quantity": quantity}],
        "notes": "Cafe top-up",
    }


def test_transfer_moves_stock_once_and_conserves_total(seeded, api, login):
    login("inventory@seasonscake.demo")
    puffs = InventoryItem.objects.get(sku="FG-005")
    home_before = stock("FG-005", "home_bakery")
    cafe_before = stock("FG-005", "cafe")

    created = api.post(
        "/api/v1/transfers/", transfer_payload(puffs), format="json"
    )
    assert created.status_code == 201
    transfer = created.data
    assert transfer["from"] == "home_bakery"
    assert transfer["to"] == "cafe"
    assert transfer["status"] == "requested"

    approved = api.post(f"/api/v1/transfers/{transfer['id']}/approve/")
    assert approved.status_code == 200
    assert approved.data["status"] == "approved"
    assert stock("FG-005", "home_bakery") == home_before

    dispatched = api.post(f"/api/v1/transfers/{transfer['id']}/dispatch/")
    assert dispatched.status_code == 200
    assert dispatched.data["status"] == "dispatched"
    assert stock("FG-005", "home_bakery") == home_before - 5
    assert stock("FG-005", "cafe") == cafe_before

    received = api.post(f"/api/v1/transfers/{transfer['id']}/receive/")
    assert received.status_code == 200
    assert received.data["status"] == "received"
    assert stock("FG-005", "home_bakery") == home_before - 5
    assert stock("FG-005", "cafe") == cafe_before + 5
    assert stock("FG-005", "home_bakery") + stock("FG-005", "cafe") == (
        home_before + cafe_before
    )
    assert StockMovement.objects.filter(
        ref_id=transfer["id"], reason="transfer_out"
    ).count() == 1
    assert StockMovement.objects.filter(
        ref_id=transfer["id"], reason="transfer_in"
    ).count() == 1
    assert api.post(f"/api/v1/transfers/{transfer['id']}/receive/").status_code == 400
    assert stock("FG-005", "cafe") == cafe_before + 5


def test_transfer_cannot_dispatch_before_approval(seeded, api, login):
    login("inventory@seasonscake.demo")
    item = InventoryItem.objects.get(sku="RM-011")
    before = stock("RM-011", "home_bakery")
    created = api.post("/api/v1/transfers/", transfer_payload(item, "3"), format="json")
    assert created.status_code == 201
    blocked = api.post(f"/api/v1/transfers/{created.data['id']}/dispatch/")
    assert blocked.status_code == 400
    assert "approve" in blocked.data["detail"].lower()
    assert stock("RM-011", "home_bakery") == before


def test_cancelled_transfer_keeps_stock(seeded, api, login):
    login("inventory@seasonscake.demo")
    item = InventoryItem.objects.get(sku="RM-011")
    before = stock("RM-011", "home_bakery")
    created = api.post("/api/v1/transfers/", transfer_payload(item, "4"), format="json")
    cancelled = api.post(f"/api/v1/transfers/{created.data['id']}/cancel/")
    assert cancelled.status_code == 200
    assert cancelled.data["status"] == "cancelled"
    assert stock("RM-011", "home_bakery") == before
    assert not StockMovement.objects.filter(ref_id=created.data["id"]).exists()


def test_transfer_requires_distinct_locations_and_permission(seeded, api, login):
    login("inventory@seasonscake.demo")
    item = InventoryItem.objects.get(sku="RM-011")
    same = api.post(
        "/api/v1/transfers/",
        {
            "from": "cafe",
            "to": "cafe",
            "lines": [{"itemId": str(item.id), "quantity": "1"}],
        },
        format="json",
    )
    assert same.status_code == 400
    assert "differ" in same.data["detail"].lower()

    login("cashier@seasonscake.demo")
    assert api.get("/api/v1/transfers/").status_code == 403
    assert api.post("/api/v1/transfers/", transfer_payload(item), format="json").status_code == 403
