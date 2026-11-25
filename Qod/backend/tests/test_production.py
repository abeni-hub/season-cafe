import pytest

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem, StockMovement
from apps.inventory.services import stock_qty
from apps.orders.models import Order
from apps.production.models import ProductionBatch
from apps.products.models import Product
from apps.recipes.models import Recipe

pytestmark = pytest.mark.django_db


def stock(sku, location="home_bakery"):
    item = InventoryItem.objects.get(sku=sku)
    return float(stock_qty(item.id, location))


def test_batch_completion_consumes_ingredients_and_adds_output_once(
    seeded, api, login
):
    login("production@seasonscake.demo")
    recipe = Recipe.objects.get(product__slug="vanilla-custard")
    milk_before = stock("RM-005")
    finished_before = stock("FG-001")

    created = api.post(
        "/api/v1/batches/create/",
        {
            "productId": str(recipe.product_id),
            "recipeId": str(recipe.id),
            "quantity": "16",
            "location": "home_bakery",
        },
        format="json",
    )
    assert created.status_code == 201
    batch = created.data
    assert batch["status"] == "scheduled"
    assert batch["title"] == "Vanilla Custard — batch"

    detail = api.get(f"/api/v1/batches/{batch['id']}/")
    assert detail.status_code == 200
    milk = next(row for row in detail.data["ingredients"] if row["name"] == "Whole milk")
    assert milk["required"] == 4
    assert milk["available"] == milk_before
    assert milk["short"] is False

    for status in ["in_production", "quality_check", "completed"]:
        response = api.post(
            f"/api/v1/batches/{batch['id']}/transition/",
            {"status": status},
            format="json",
        )
        assert response.status_code == 200, response.content

    assert stock("RM-005") == milk_before - 4
    assert stock("FG-001") == finished_before + 16
    assert StockMovement.objects.filter(
        reason="production_consumption", ref_id=batch["id"]
    ).count() >= 1
    assert (
        StockMovement.objects.filter(
            reason="production_output", ref_id=batch["id"], item__sku="FG-001"
        ).count()
        == 1
    )

    ready = api.post(
        f"/api/v1/batches/{batch['id']}/transition/",
        {"status": "ready"},
        format="json",
    )
    assert ready.status_code == 200
    assert stock("RM-005") == milk_before - 4
    assert stock("FG-001") == finished_before + 16
    again = api.post(
        f"/api/v1/batches/{batch['id']}/transition/",
        {"status": "completed"},
        format="json",
    )
    assert again.status_code == 400


def test_completing_batch_moves_linked_order_to_ready(seeded, api, login):
    login("manager@seasonscake.demo")
    customer = Customer.objects.get(organization="Brightline Demo Ltd")
    order = api.post(
        "/api/v1/orders/create/",
        {
            "type": "bulk",
            "customerId": str(customer.id),
            "items": [
                {"description": "Cream puffs", "quantity": "1", "unitPriceCents": 500000}
            ],
            "status": "confirmed",
        },
        format="json",
    ).data
    recipe = Recipe.objects.get(product__slug="cream-puffs")

    batch = api.post(
        "/api/v1/batches/create/",
        {
            "productId": str(recipe.product_id),
            "recipeId": str(recipe.id),
            "orderId": order["id"],
            "quantity": "6",
            "location": "home_bakery",
        },
        format="json",
    )
    assert batch.status_code == 201
    assert Order.objects.get(pk=order["id"]).status == "in_production"

    for status in ["in_production", "quality_check", "completed"]:
        response = api.post(
            f"/api/v1/batches/{batch.data['id']}/transition/",
            {"status": status},
            format="json",
        )
        assert response.status_code == 200, response.content

    assert Order.objects.get(pk=order["id"]).status == "ready"


def test_batch_completion_rejects_missing_ingredients(seeded, api, login):
    login("production@seasonscake.demo")
    recipe = Recipe.objects.get(product__slug="vanilla-custard")
    created = api.post(
        "/api/v1/batches/create/",
        {
            "productId": str(recipe.product_id),
            "recipeId": str(recipe.id),
            "quantity": "8",
            "location": "cafe",
        },
        format="json",
    )
    assert created.status_code == 201
    for status in ["in_production", "quality_check"]:
        api.post(
            f"/api/v1/batches/{created.data['id']}/transition/",
            {"status": status},
            format="json",
        )
    failed = api.post(
        f"/api/v1/batches/{created.data['id']}/transition/",
        {"status": "completed"},
        format="json",
    )
    assert failed.status_code == 400
    assert "not enough" in failed.data["detail"].lower()
    assert ProductionBatch.objects.get(pk=created.data["id"]).status == "quality_check"
    assert not StockMovement.objects.filter(
        reason="production_output", ref_id=created.data["id"]
    ).exists()


def test_batch_recipe_must_match_product(seeded, api, login):
    login("production@seasonscake.demo")
    vanilla = Product.objects.get(slug="vanilla-custard")
    chocolate_recipe = Recipe.objects.get(product__slug="chocolate-custard")
    response = api.post(
        "/api/v1/batches/create/",
        {
            "productId": str(vanilla.id),
            "recipeId": str(chocolate_recipe.id),
            "quantity": "8",
            "location": "home_bakery",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "recipe" in response.data["detail"].lower()
