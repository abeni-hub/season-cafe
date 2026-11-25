import pytest
from django.core.cache import cache

from apps.accounts.models import User
from apps.products.models import Product

pytestmark = pytest.mark.django_db


def test_login_returns_tokens_and_user(seeded, api):
    response = api.post(
        "/api/v1/auth/login/",
        {"email": "cashier@seasonscake.demo", "password": "test-pass-123"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["access"] and response.data["refresh"]
    user = response.data["user"]
    assert user["email"] == "cashier@seasonscake.demo"
    assert user["role"] == "cashier"
    assert "pos.use" in user["permissions"]
    assert "employees.manage" not in user["permissions"]
    assert "password" not in user


def test_login_rejects_bad_password(seeded, api):
    response = api.post(
        "/api/v1/auth/login/",
        {"email": "owner@seasonscake.demo", "password": "wrong-password"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["detail"] == "Incorrect email or password."


def test_inactive_user_cannot_log_in(seeded, api):
    user = User.objects.get(email="cashier@seasonscake.demo")
    user.is_active = False
    user.save(update_fields=["is_active"])
    response = api.post(
        "/api/v1/auth/login/",
        {"email": "cashier@seasonscake.demo", "password": "test-pass-123"},
        format="json",
    )
    assert response.status_code == 400


def test_protected_endpoint_requires_authentication(seeded, api):
    assert api.get("/api/v1/orders/").status_code == 401
    assert api.get("/api/v1/reports/dashboard/").status_code == 401
    assert api.get("/api/v1/employees/").status_code == 401


def test_me_reflects_role(seeded, api, login):
    login("manager@seasonscake.demo")
    response = api.get("/api/v1/auth/me/")
    assert response.status_code == 200
    assert response.data["role"] == "manager"
    assert "employees.manage" not in response.data["permissions"]
    assert "reports.view" in response.data["permissions"]


def test_cashier_cannot_access_employee_management(seeded, api, login):
    login("cashier@seasonscake.demo")
    assert api.get("/api/v1/employees/").status_code == 403
    response = api.post(
        "/api/v1/employees/",
        {
            "name": "Nope",
            "email": "nope@seasonscake.demo",
            "password": "strong-pass-123",
            "role": "manager",
        },
        format="json",
    )
    assert response.status_code == 403
    assert "role" in response.data["detail"].lower()


def test_role_matrix_is_authoritative(seeded, api, login):
    login("production@seasonscake.demo")
    assert api.get("/api/v1/recipes/").status_code == 200
    assert api.get("/api/v1/inventory/items/").status_code == 200
    assert api.get("/api/v1/purchase-orders/").status_code == 403
    assert api.get("/api/v1/payments/").status_code == 403

    login("inventory@seasonscake.demo")
    assert api.get("/api/v1/purchase-orders/").status_code == 200
    assert api.get("/api/v1/employees/").status_code == 403
    assert api.get("/api/v1/reports/dashboard/").status_code == 200

    login("manager@seasonscake.demo")
    assert api.get("/api/v1/purchase-orders/").status_code == 200
    assert api.get("/api/v1/site/content/").status_code == 200
    assert api.get("/api/v1/employees/").status_code == 403


def test_bootstrap_filters_payload_by_role(seeded, api, login):
    login("cashier@seasonscake.demo")
    cashier = api.get("/api/v1/bootstrap/").data
    assert len(cashier["products"]) == 7
    assert cashier["orders"]
    assert cashier["customers"]
    assert cashier["inventoryItems"]
    assert cashier["employees"] == []
    assert cashier["suppliers"] == []
    assert cashier["messages"] == []

    login("owner@seasonscake.demo")
    owner = api.get("/api/v1/bootstrap/").data
    assert len(owner["employees"]) == 6
    assert len(owner["suppliers"]) == 2
    assert len(owner["recipes"]) == 7
    assert owner["counters"] == {
        "pos": 1007,
        "order": 2003,
        "inquiry": 3001,
        "po": 5002,
        "batch": 7003,
        "transfer": 6002,
    }


def test_anonymous_bootstrap_is_public_safe(seeded, api):
    response = api.get("/api/v1/bootstrap/")
    assert response.status_code == 200
    data = response.data
    assert len(data["products"]) == 7
    assert data["customers"] == []
    assert data["orders"] == []
    assert data["payments"] == []
    assert data["employees"] == []
    assert data["siteContent"]["heroTitle"] == "Baked with the seasons"


def test_product_visibility_respects_publish_flag(seeded, api):
    product = Product.objects.get(slug="mocha")
    product.is_published = False
    product.save(update_fields=["is_published"])

    listing = api.get("/api/v1/products/")
    assert listing.status_code == 200
    assert listing.data["count"] == 6
    assert all(row["slug"] != "mocha" for row in listing.data["results"])
    assert api.get(f"/api/v1/products/{product.id}/").status_code == 404


def test_public_site_endpoint(seeded, api):
    response = api.get("/api/v1/site/")
    assert response.status_code == 200
    assert len(response.data["products"]) == 7
    assert response.data["settings"]["currency"] == "NGN"


def test_health_endpoint(seeded, api):
    response = api.get("/health/")
    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["database"] == "ok"


def test_logout_blacklists_refresh_token(seeded, api, login):
    cache.clear()
    tokens = login("manager@seasonscake.demo")
    response = api.post(
        "/api/v1/auth/logout/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert response.status_code == 204
    refresh = api.post(
        "/api/v1/auth/refresh/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert refresh.status_code == 401
