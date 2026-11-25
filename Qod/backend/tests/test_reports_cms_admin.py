import pytest

from apps.accounts.models import User
from apps.core.models import BusinessSettings
from apps.expenses.models import Expense
from apps.inventory.models import InventoryItem
from apps.inventory.services import stock_qty
from apps.website.models import Message, SiteContent

pytestmark = pytest.mark.django_db


def stock(sku, location="home_bakery"):
    item = InventoryItem.objects.get(sku=sku)
    return float(stock_qty(item.id, location))


def test_dashboard_and_reports(seeded, api, login):
    login("manager@seasonscake.demo")
    dashboard = api.get("/api/v1/reports/dashboard/")
    assert dashboard.status_code == 200
    for key in [
        "todayCollectedCents",
        "last30CollectedCents",
        "outstandingCents",
        "pendingOrders",
        "activeBatches",
        "lowStockCount",
    ]:
        assert key in dashboard.data
    assert dashboard.data["outstandingCents"] == 13600000
    assert dashboard.data["activeBatches"] == 2
    assert len(dashboard.data["recentOrders"]) <= 6
    assert dashboard.data["recentActivity"]

    sales = api.get("/api/v1/reports/sales/?days=7")
    assert sales.status_code == 200
    assert len(sales.data) == 7

    products = api.get("/api/v1/reports/products/?days=30")
    assert products.status_code == 200
    assert products.data

    expenses = api.get("/api/v1/reports/expenses/?days=30")
    assert expenses.status_code == 200
    assert expenses.data["totalCents"] == 14200000
    assert any(row["category"] == "utilities" for row in expenses.data["byCategory"])

    valuation = api.get("/api/v1/reports/valuation/")
    assert valuation.status_code == 200

    balances = api.get("/api/v1/reports/customer-balances/")
    assert balances.status_code == 200
    brightline = next(row for row in balances.data if row["name"] == "Brightline Demo Ltd")
    assert brightline["balanceCents"] == 13600000

    supplier_report = api.get("/api/v1/reports/supplier-balances/")
    assert supplier_report.status_code == 200
    assert len(supplier_report.data) == 2


def test_cashier_cannot_view_financial_reports(seeded, api, login):
    login("cashier@seasonscake.demo")
    assert api.get("/api/v1/reports/dashboard/").status_code == 200
    assert api.get("/api/v1/reports/sales/").status_code == 403
    assert api.get("/api/v1/reports/supplier-balances/").status_code == 403
    assert api.get("/api/v1/expenses/").status_code == 403


def test_expense_recording(seeded, api, login):
    login("manager@seasonscake.demo")
    response = api.post(
        "/api/v1/expenses/create/",
        {
            "category": "ingredients",
            "amountCents": 3200000,
            "location": "home_bakery",
            "note": "Flour restock",
            "incurredAt": "2026-11-20",
        },
        format="json",
    )
    assert response.status_code == 201
    assert Expense.objects.count() == 4
    empty_note = api.post(
        "/api/v1/expenses/create/",
        {
            "category": "other",
            "amountCents": 1000,
            "location": "cafe",
            "note": "  ",
            "incurredAt": "2026-11-20",
        },
        format="json",
    )
    assert empty_note.status_code == 400


def test_inventory_adjustments_and_item_creation(seeded, api, login):
    login("inventory@seasonscake.demo")
    flour = InventoryItem.objects.get(sku="RM-001")
    before = stock("RM-001")

    removed = api.post(
        "/api/v1/inventory/adjustments/",
        {
            "itemId": str(flour.id),
            "location": "home_bakery",
            "mode": "remove",
            "quantity": "5",
            "note": "Damaged bag",
        },
        format="json",
    )
    assert removed.status_code == 201
    assert stock("RM-001") == before - 5
    assert removed.data["reason"] == "adjustment"

    wasted = api.post(
        "/api/v1/inventory/adjustments/",
        {
            "itemId": str(flour.id),
            "location": "home_bakery",
            "mode": "wastage",
            "quantity": "2",
            "note": "Spillage",
        },
        format="json",
    )
    assert wasted.status_code == 201
    assert wasted.data["reason"] == "wastage"
    assert stock("RM-001") == before - 7

    too_much = api.post(
        "/api/v1/inventory/adjustments/",
        {
            "itemId": str(flour.id),
            "location": "home_bakery",
            "mode": "remove",
            "quantity": "1000",
        },
        format="json",
    )
    assert too_much.status_code == 400
    assert stock("RM-001") == before - 7

    created = api.post(
        "/api/v1/inventory/items/create/",
        {
            "name": "Sea salt",
            "kind": "raw",
            "unit": "g",
            "costPerUnitCents": 5000,
            "reorderLevel": "5",
        },
        format="json",
    )
    assert created.status_code == 201
    assert created.data["sku"] == "RM-013"

    finished_attempt = api.post(
        "/api/v1/inventory/items/create/",
        {
            "name": "Fake finished good",
            "kind": "finished",
            "unit": "pcs",
            "costPerUnitCents": 1000,
            "reorderLevel": "1",
        },
        format="json",
    )
    assert finished_attempt.status_code == 400


def test_stock_listing_and_movement_filters(seeded, api, login):
    login("inventory@seasonscake.demo")
    stock_list = api.get("/api/v1/inventory/stock/")
    assert stock_list.status_code == 200
    assert stock_list.data["count"] == 22
    row = next(
        row for row in stock_list.data["results"] if row["item"]["sku"] == "RM-001"
    )
    assert row["byLocation"] == {"home_bakery": 80, "cafe": 0}
    assert row["total"] == 80
    assert row["low"] is False

    movements = api.get("/api/v1/inventory/movements/?reason=opening")
    assert movements.status_code == 200
    assert movements.data["count"] == 32
    assert all(m["reason"] == "opening" for m in movements.data["results"])


def test_employee_management(seeded, api, login):
    login("owner@seasonscake.demo")
    created = api.post(
        "/api/v1/employees/",
        {
            "name": "New Baker",
            "email": "new.baker@seasonscake.demo",
            "password": "strong-pass-123",
            "role": "production",
        },
        format="json",
    )
    assert created.status_code == 201
    assert created.data["role"] == "production"
    assert created.data["password"] == ""
    employee_id = created.data["id"]

    duplicate = api.post(
        "/api/v1/employees/",
        {
            "name": "Duplicate",
            "email": "NEW.BAKER@seasonscake.demo",
            "password": "strong-pass-123",
            "role": "cashier",
        },
        format="json",
    )
    assert duplicate.status_code == 400

    updated = api.patch(
        f"/api/v1/employees/{employee_id}/",
        {"role": "cashier", "isActive": False},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["role"] == "cashier"
    assert updated.data["isActive"] is False

    owner = User.objects.get(email="owner@seasonscake.demo")
    self_deactivate = api.patch(
        f"/api/v1/employees/{owner.id}/", {"isActive": False}, format="json"
    )
    assert self_deactivate.status_code == 400
    assert "own account" in self_deactivate.data["detail"].lower()


def test_website_cms_and_public_messages(seeded, api, login):
    public = api.get("/api/v1/site/")
    assert public.status_code == 200
    public_message = api.post(
        "/api/v1/messages/",
        {
            "name": "Site Visitor",
            "email": "visitor@example.test",
            "subject": "Cake enquiry",
            "body": "Do you deliver on Saturdays?",
        },
        format="json",
    )
    assert public_message.status_code == 201
    assert Message.objects.count() == 2
    assert api.get("/api/v1/messages/").status_code == 401

    login("cashier@seasonscake.demo")
    assert api.get("/api/v1/messages/").status_code == 403
    assert api.get("/api/v1/site/content/").status_code == 403

    login("owner@seasonscake.demo")
    listing = api.get("/api/v1/messages/")
    assert listing.status_code == 200
    assert len(listing.data) == 2
    message_id = listing.data[0]["id"]
    read = api.post(f"/api/v1/messages/{message_id}/read/")
    assert read.status_code == 200
    assert read.data["isRead"] is True

    patched = api.patch(
        "/api/v1/site/content/",
        {"heroTitle": "Baked with the seasons", "contactEmail": "hello@example.test"},
        format="json",
    )
    assert patched.status_code == 200
    assert patched.data["contactEmail"] == "hello@example.test"
    assert SiteContent.load().hero_title == "Baked with the seasons"

    blank = api.patch("/api/v1/site/content/", {"heroTitle": " "}, format="json")
    assert blank.status_code == 400

    settings = api.patch(
        "/api/v1/site/settings/",
        {"businessName": "Seasons Cake", "currency": "NGN", "tagline": "Baked daily"},
        format="json",
    )
    assert settings.status_code == 200
    assert settings.data["currency"] == "NGN"
    assert BusinessSettings.load().tagline == "Baked daily"
    bad_currency = api.patch(
        "/api/v1/site/settings/", {"currency": "ngn"}, format="json"
    )
    assert bad_currency.status_code == 400
    assert BusinessSettings.load().currency == "NGN"
    bad_code = api.patch(
        "/api/v1/site/settings/", {"currency": "naira"}, format="json"
    )
    assert bad_code.status_code == 400


def test_standardized_errors(seeded, api, login):
    login("manager@seasonscake.demo")
    missing = api.get("/api/v1/orders/00000000-0000-0000-0000-000000000000/")
    assert missing.status_code == 400
    assert missing.data["detail"] == "Order not found."

    invalid = api.post(
        "/api/v1/orders/create/",
        {"type": "not-a-type", "customerId": "x", "items": []},
        format="json",
    )
    assert invalid.status_code == 400
    assert invalid.data["detail"]
    assert invalid.data["errors"]
