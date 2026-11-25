from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless

from django.db import close_old_connections, connection, connections
from django.test import TransactionTestCase
from rest_framework.exceptions import ValidationError

from .models import (
    CakeProduct,
    Ingredient,
    Location,
    ProductBalance,
    ProductionBatch,
    Recipe,
    RecipeIngredient,
    StockMovement,
    User,
)
from .services import create_sale, produce_cakes, record_stock


@skipUnless(connection.vendor == "postgresql", "Row-lock concurrency checks require PostgreSQL.")
class StockConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Concurrency Kitchen", code="concurrency-kitchen")
        self.users = [
            User.objects.create_user(
                username=f"cashier-{index}",
                password="test-password-123",
                role=User.Role.MANAGER,
                location=self.location,
                business_permissions=["sales", "production", "purchases"],
            )
            for index in (1, 2)
        ]
        self.product = CakeProduct.objects.create(
            name="Concurrency Cake",
            sku="CONCURRENCY-CAKE",
            unit_price=Decimal("10.00"),
        )
        self.ingredient = Ingredient.objects.create(
            name="Concurrency Flour",
            unit=Ingredient.Unit.KILOGRAM,
            reorder_level=Decimal("0.100"),
        )
        self.recipe = Recipe.objects.create(product=self.product)
        RecipeIngredient.objects.create(
            recipe=self.recipe,
            ingredient=self.ingredient,
            quantity=Decimal("1.000"),
            unit=Ingredient.Unit.KILOGRAM,
        )

    @staticmethod
    def _run_concurrently(operation, count=2):
        barrier = Barrier(count)

        def guarded(index):
            try:
                close_old_connections()
                barrier.wait(timeout=15)
                try:
                    operation(index)
                    return "completed"
                except ValidationError:
                    return "rejected"
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=count) as executor:
            futures = [executor.submit(guarded, index) for index in range(count)]
            outcomes = []
            failures = []
            for future in futures:
                try:
                    outcomes.append(future.result(timeout=45))
                except Exception as error:
                    failures.append(error)
            if failures:
                raise AssertionError(
                    "Concurrent workers failed unexpectedly: "
                    + "; ".join(repr(error) for error in failures),
                )
            return outcomes

    def test_two_simultaneous_sales_cannot_oversell_one_cake(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("1"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.users[0],
        )

        def sell(index):
            actor = User.objects.get(pk=self.users[index].pk)
            location = Location.objects.get(pk=self.location.pk)
            product = CakeProduct.objects.get(pk=self.product.pk)
            create_sale(
                location=location,
                actor=actor,
                items=[{"product": product, "quantity": 1}],
                payments=[],
                idempotency_key=f"concurrent-sale-{index}",
            )

        outcomes = self._run_concurrently(sell)

        self.assertCountEqual(outcomes, ["completed", "rejected"])
        self.assertEqual(ProductBalance.objects.get(location=self.location, product=self.product).quantity, 0)

    def test_two_simultaneous_production_batches_cannot_overconsume_ingredients(self):
        record_stock(
            location=self.location,
            ingredient=self.ingredient,
            quantity_delta=Decimal("1.000"),
            kind=StockMovement.Kind.PURCHASE,
            actor=self.users[0],
        )

        def produce(index):
            actor = User.objects.get(pk=self.users[index].pk)
            location = Location.objects.get(pk=self.location.pk)
            product = CakeProduct.objects.get(pk=self.product.pk)
            produce_cakes(
                location=location,
                actor=actor,
                product=product,
                quantity=1,
                idempotency_key=f"concurrent-production-{index}",
            )

        outcomes = self._run_concurrently(produce)

        self.assertCountEqual(outcomes, ["completed", "rejected"])
        self.assertEqual(ProductionBatch.objects.count(), 1)
        self.assertEqual(
            self.ingredient.balances.get(location=self.location).quantity,
            Decimal("0.000"),
        )
