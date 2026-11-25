from decimal import Decimal

from django.test import Client, TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from .admin import BusinessUserCreationForm
from .models import (
    AuditEvent,
    BusinessSettings,
    CakeProduct,
    CustomerOrder,
    CustomerOrderStatusHistory,
    Ingredient,
    IngredientBalance,
    IngredientPurchase,
    Location,
    Payment,
    ProductBalance,
    ProductionBatch,
    Recipe,
    RecipeIngredient,
    Sale,
    SaleRefund,
    StockMovement,
    StockTransfer,
    StockTransferReceipt,
    TransferShipment,
    User,
)
from .services import record_stock, transfer_stock
from .tasks import report_low_stock
from .units import convert_quantity


class BusinessApiTests(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Test Kitchen", code="test-kitchen")
        self.other_location = Location.objects.create(name="Other Kitchen", code="other-kitchen")
        self.manager = User.objects.create_user(
            username="manager",
            password="test-password-123",
            role=User.Role.MANAGER,
            location=self.location,
        )
        self.product = CakeProduct.objects.create(
            name="Test Cake",
            sku="TEST-CAKE",
            unit_price=Decimal("10.00"),
        )
        self.ingredient = Ingredient.objects.create(
            name="Test Flour",
            unit="kg",
            reorder_level=Decimal("1.000"),
        )
        self.recipe = Recipe.objects.create(product=self.product)
        RecipeIngredient.objects.create(
            recipe=self.recipe,
            ingredient=self.ingredient,
            quantity=Decimal("0.250"),
            unit=self.ingredient.unit,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)

    def test_staff_cannot_read_another_locations_inventory(self):
        response = self.client.get(
            "/api/inventory/",
            {"location": self.other_location.pk},
        )

        self.assertEqual(response.status_code, 403)

    @override_settings(
        SECURE_SSL_REDIRECT=True,
        SECURE_REDIRECT_EXEMPT=[r"^health/(?:live|ready)/$"],
    )
    def test_health_endpoints_allow_internal_http_probes_when_https_is_enforced(self):
        response = Client().get("/health/ready/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ready"})

    def test_versioned_api_and_legacy_alias_preserve_search_and_pagination(self):
        CakeProduct.objects.create(name="Vanilla Cake", sku="VANILLA")

        versioned = self.client.get("/api/v1/products/?search=Test&page_size=1")
        legacy = self.client.get("/api/products/?search=Test&page_size=1")

        self.assertEqual(versioned.status_code, 200)
        self.assertEqual(versioned.data["count"], 1)
        self.assertEqual(len(versioned.data["results"]), 1)
        self.assertIsNone(versioned.data["next"])
        self.assertEqual(legacy.status_code, 200)
        self.assertEqual(legacy.data["count"], versioned.data["count"])

    def test_owner_can_manage_catalog_and_create_audited_recipe_versions(self):
        owner = User.objects.create_user(username="catalog-owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)

        product = self.client.post(
            "/api/products/",
            {
                "name": "Vanilla Custard",
                "web_id": "vanilla-custard",
                "unit_price": "125.00",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(product.status_code, 201, product.data)
        self.assertEqual(product.data["web_id"], "vanilla-custard")

        ingredient = self.client.post(
            "/api/ingredients/",
            {"name": "Cake Flour", "unit": "kg", "reorder_level": "1.000"},
            format="json",
        )
        self.assertEqual(ingredient.status_code, 201, ingredient.data)

        recipe = self.client.post(
            "/api/recipes/",
            {
                "product": product.data["id"],
                "ingredients": [
                    {"ingredient": ingredient.data["id"], "quantity": "0.250", "unit": "kg"},
                ],
            },
            format="json",
        )
        self.assertEqual(recipe.status_code, 201, recipe.data)
        self.assertEqual(recipe.data["version"], 1)

        unit_change = self.client.patch(
            f"/api/ingredients/{ingredient.data['id']}/",
            {"unit": "g"},
            format="json",
        )
        self.assertEqual(unit_change.status_code, 400, unit_change.data)

        actions = set(
            AuditEvent.objects.filter(actor=owner).values_list("action", flat=True),
        )
        self.assertTrue({"product_create", "ingredient_create", "recipe_create"}.issubset(actions))

        catalog_manager = User.objects.create_user(
            username="catalog-manager",
            role=User.Role.MANAGER,
            location=self.location,
            business_permissions=["catalog"],
        )
        self.client.force_authenticate(catalog_manager)
        self.assertEqual(self.client.get("/api/products/").status_code, 200)
        self.assertEqual(self.client.get("/api/ingredients/").status_code, 200)
        self.assertEqual(
            self.client.post(
                "/api/ingredients/",
                {"name": "Baking Powder", "unit": "g"},
                format="json",
            ).status_code,
            201,
        )

        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get("/api/products/").status_code, 200)
        self.assertEqual(
            self.client.post(
                "/api/products/",
                {"name": "Unauthorized Cake", "web_id": "unauthorized-cake"},
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/ingredients/",
                {"name": "Unauthorized Flour", "unit": "kg"},
                format="json",
            ).status_code,
            403,
        )

    def test_product_deletion_respects_public_permissions_and_protected_history(self):
        catalog_manager = User.objects.create_user(
            username="catalog-manager",
            role=User.Role.MANAGER,
            location=self.location,
            business_permissions=["catalog"],
        )
        published_product = CakeProduct.objects.create(
            name="Published Cake",
            web_id="published-cake",
            unit_price=Decimal("25.00"),
            is_published=True,
        )
        self.client.force_authenticate(catalog_manager)

        forbidden = self.client.delete(f"/api/products/{published_product.pk}/")

        self.assertEqual(forbidden.status_code, 403)
        self.assertTrue(CakeProduct.objects.filter(pk=published_product.pk).exists())

        owner = User.objects.create_user(username="delete-owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)
        protected = self.client.delete(f"/api/products/{self.product.pk}/")

        self.assertEqual(protected.status_code, 400)
        self.assertTrue(CakeProduct.objects.filter(pk=self.product.pk).exists())

        unused_product = CakeProduct.objects.create(name="Unused Cake")
        deleted = self.client.delete(f"/api/products/{unused_product.pk}/")

        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(CakeProduct.objects.filter(pk=unused_product.pk).exists())
        self.assertTrue(
            AuditEvent.objects.filter(
                actor=owner,
                action="product_delete",
                target_id=str(unused_product.pk),
            ).exists(),
        )

    def test_service_stock_writes_recheck_business_permissions(self):
        employee = User.objects.create_user(
            username="restricted-employee",
            role=User.Role.EMPLOYEE,
            workspace=User.Workspace.CAFE,
            location=self.location,
            business_permissions=[],
        )

        with self.assertRaises(PermissionDenied):
            record_stock(
                location=self.location,
                product=self.product,
                quantity_delta=Decimal("-1"),
                kind=StockMovement.Kind.SALE,
                actor=employee,
            )

        self.assertFalse(ProductBalance.objects.filter(location=self.location, product=self.product).exists())
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_report_filters_cover_date_product_payment_and_employee(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("2"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        sale = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "filtered-report-sale",
                "items": [{"product": self.product.pk, "quantity": 1}],
                "payments": [{"method": "cash", "amount": "10.00"}],
            },
            format="json",
        )
        self.assertEqual(sale.status_code, 201, sale.data)

        today = timezone.localdate().isoformat()
        response = self.client.get(
            "/api/dashboard/",
            {
                "start_date": today,
                "end_date": today,
                "product": self.product.pk,
                "payment_method": "cash",
                "employee": self.manager.pk,
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["startDate"], today)
        self.assertEqual(response.data["endDate"], today)
        self.assertEqual(response.data["summary"]["salesTotal"], Decimal("10.00"))
        self.assertEqual(response.data["summary"]["cashCollected"], Decimal("10.00"))
        self.assertEqual(response.data["summary"]["salesByCake"][0]["product"], "Test Cake")

    def test_product_report_filter_excludes_other_sale_lines(self):
        other_product = CakeProduct.objects.create(
            name="Other Cake",
            sku="OTHER-CAKE",
            unit_price=Decimal("20.00"),
        )
        for product in (self.product, other_product):
            record_stock(
                location=self.location,
                product=product,
                quantity_delta=Decimal("1"),
                kind=StockMovement.Kind.PRODUCTION_OUTPUT,
                actor=self.manager,
            )
        sale = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "mixed-cake-report-sale",
                "items": [
                    {"product": self.product.pk, "quantity": 1},
                    {"product": other_product.pk, "quantity": 1},
                ],
                "payments": [{"method": "cash", "amount": "30.00"}],
            },
            format="json",
        )
        self.assertEqual(sale.status_code, 201, sale.data)

        response = self.client.get("/api/dashboard/", {"product": self.product.pk})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["salesTotal"], Decimal("10.00"))
        self.assertEqual(response.data["summary"]["cakesSold"], 1)
        self.assertEqual(
            response.data["summary"]["salesByCake"],
            [{"product": "Test Cake", "quantity": 1, "sales": Decimal("10.00")}],
        )

    def test_report_filters_are_not_available_without_reports_permission(self):
        employee = User.objects.create_user(
            username="cafe-employee",
            role=User.Role.EMPLOYEE,
            workspace=User.Workspace.CAFE,
            location=self.location,
        )
        self.client.force_authenticate(employee)

        response = self.client.get("/api/dashboard/", {"payment_method": "cash"})

        self.assertEqual(response.status_code, 403)

    def test_report_employee_list_is_location_scoped_and_minimal(self):
        other_employee = User.objects.create_user(
            username="other-location-employee",
            role=User.Role.EMPLOYEE,
            workspace=User.Workspace.CAFE,
            location=self.other_location,
        )

        response = self.client.get("/api/v1/users/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual({row["id"] for row in response.data["results"]}, {self.manager.pk})
        self.assertNotIn("email", response.data["results"][0])
        self.assertNotIn(other_employee.pk, {row["id"] for row in response.data["results"]})

    def test_daily_low_stock_task_logs_low_balances(self):
        IngredientBalance.objects.create(
            location=self.location,
            ingredient=self.ingredient,
            quantity=Decimal("0.500"),
        )

        with self.assertLogs("seasonops.tasks", level="WARNING") as captured:
            count = report_low_stock.run()

        self.assertEqual(count, 1)
        self.assertEqual(captured.records[0].ingredient, "Test Flour")

    def test_sale_records_multiple_items_and_payments(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("4"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        mocha = CakeProduct.objects.create(
            name="Mocha",
            sku="MOCHA",
            unit_price=Decimal("12.00"),
        )
        record_stock(
            location=self.location,
            product=mocha,
            quantity_delta=Decimal("2"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )

        payload = {
            "idempotency_key": "sale-multi-item-001",
            "items": [
                {"product": self.product.pk, "quantity": 1},
                {"product": self.product.pk, "quantity": 2},
                {"product": mocha.pk, "quantity": 1},
            ],
            "payments": [
                {"method": "cash", "amount": "5.00", "payment_date": "2026-11-22"},
                {"method": "telebirr", "amount": "10.00"},
                {
                    "method": "bank_transfer",
                    "amount": "12.00",
                    "bank_name": "Awash",
                    "payment_date": "2026-11-22",
                },
            ],
        }
        response = self.client.post("/api/sales/", payload, format="json")
        retry = self.client.post("/api/sales/", payload, format="json")
        conflict = self.client.post(
            "/api/sales/",
            {**payload, "items": [{"product": self.product.pk, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(retry.status_code, 201, retry.data)
        self.assertEqual(retry.data["id"], response.data["id"])
        self.assertEqual(conflict.status_code, 400)
        self.assertEqual(len(response.data["lines"]), 2)
        self.assertEqual(response.data["total"], "42.00")
        self.assertEqual(response.data["amount_paid"], Decimal("27.00"))
        self.assertEqual(response.data["amount_due"], Decimal("15.00"))
        self.assertEqual(response.data["payment_history"][2]["bank_name"], "Awash")
        self.assertEqual(response.data["payment_history"][2]["payment_date"], "2026-11-22")
        self.assertEqual(ProductBalance.objects.get(location=self.location, product=self.product).quantity, Decimal("1.000"))
        self.assertEqual(ProductBalance.objects.get(location=self.location, product=mocha).quantity, Decimal("1.000"))

    def test_sale_failure_rolls_back_sale_and_stock_changes(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("1"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )

        response = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-oversell-001",
                "items": [{"product": self.product.pk, "quantity": 2, "unit_price": "10.00"}],
                "payments": [{"method": "cash", "amount": "20.00"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 1)
        self.assertEqual(ProductBalance.objects.get(location=self.location, product=self.product).quantity, Decimal("1.000"))

    def test_followup_payment_cannot_exceed_remaining_sale_balance(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("2"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        sale = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-partial-payment-001",
                "items": [{"product": self.product.pk, "quantity": 1, "unit_price": "10.00"}],
                "payments": [{"method": "cash", "amount": "5.00"}],
            },
            format="json",
        )
        self.assertEqual(sale.status_code, 201, sale.data)

        collected = self.client.post(
            f"/api/sales/{sale.data['id']}/payments/",
            {
                "method": "telebirr",
                "amount": "3.00",
                "payment_date": "2026-11-22",
                "idempotency_key": "payment-capture-001",
            },
            format="json",
        )
        retry = self.client.post(
            f"/api/sales/{sale.data['id']}/payments/",
            {
                "method": "telebirr",
                "amount": "3.00",
                "payment_date": "2026-11-22",
                "idempotency_key": "payment-capture-001",
            },
            format="json",
        )
        overpayment = self.client.post(
            f"/api/sales/{sale.data['id']}/payments/",
            {
                "method": "bank_transfer",
                "amount": "3.00",
                "bank_name": "Awash",
                "idempotency_key": "payment-overpay-001",
            },
            format="json",
        )

        self.assertEqual(collected.status_code, 201, collected.data)
        self.assertEqual(retry.status_code, 201, retry.data)
        self.assertEqual(retry.data["id"], collected.data["id"])
        self.assertEqual(overpayment.status_code, 400)
        self.assertEqual(Sale.objects.get(pk=sale.data["id"]).payments.count(), 2)

    def test_partial_refund_is_idempotent_and_reverses_returned_stock(self):
        payment_date = timezone.localdate().isoformat()
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("4"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        sale = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-refund-base-001",
                "items": [{"product": self.product.pk, "quantity": 2}],
                "payments": [
                    {"method": "cash", "amount": "10.00", "payment_date": payment_date},
                    {
                        "method": "bank_transfer",
                        "amount": "10.00",
                        "bank_name": "Awash",
                        "payment_date": payment_date,
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(sale.status_code, 201, sale.data)
        payload = {
            "idempotency_key": "sale-refund-001",
            "method": "bank_transfer",
            "amount": "5.00",
            "bank_name": "Awash",
            "refund_date": payment_date,
            "reason": "One cake was returned unopened.",
            "items": [{"product": self.product.pk, "quantity": 1}],
        }
        refund = self.client.post(
            f"/api/sales/{sale.data['id']}/refunds/",
            payload,
            format="json",
        )
        retry = self.client.post(
            f"/api/sales/{sale.data['id']}/refunds/",
            payload,
            format="json",
        )
        over_refund = self.client.post(
            f"/api/sales/{sale.data['id']}/refunds/",
            {**payload, "idempotency_key": "sale-refund-too-much-001", "amount": "16.00"},
            format="json",
        )
        self.assertEqual(refund.status_code, 201, refund.data)
        self.assertEqual(retry.status_code, 201, retry.data)
        self.assertEqual(retry.data["id"], refund.data["id"])
        self.assertEqual(over_refund.status_code, 400)
        self.assertEqual(SaleRefund.objects.count(), 1)
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("3.000"),
        )
        self.assertEqual(
            StockMovement.objects.filter(kind=StockMovement.Kind.SALE_RETURN).count(),
            1,
        )
        dashboard = self.client.get("/api/dashboard/", {"period": "daily"})
        summary = dashboard.data["summary"]
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertEqual(summary["refundsTotal"], Decimal("5.00"))
        self.assertEqual(summary["netPayments"], Decimal("15.00"))
        self.assertEqual(
            summary["bankTransferByBank"],
            [{"bank_name": "Awash", "collected": Decimal("10.00"), "refunded": Decimal("5.00"), "net": Decimal("5.00")}],
        )

    def test_sale_cancellation_refunds_payments_and_reverses_all_stock_once(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("4"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        sale = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-cancel-base-001",
                "items": [{"product": self.product.pk, "quantity": 2}],
                "payments": [
                    {"method": "cash", "amount": "5.00"},
                    {"method": "bank_transfer", "amount": "15.00", "bank_name": "Awash"},
                ],
            },
            format="json",
        )
        self.assertEqual(sale.status_code, 201, sale.data)
        payload = {
            "idempotency_key": "sale-cancel-001",
            "reason": "The customer cancelled before collection.",
            "confirm_restock": True,
        }
        cancelled = self.client.post(
            f"/api/sales/{sale.data['id']}/cancel/",
            payload,
            format="json",
        )
        retry = self.client.post(
            f"/api/sales/{sale.data['id']}/cancel/",
            payload,
            format="json",
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertEqual(cancelled.data["status"], Sale.Status.CANCELLED)
        self.assertEqual(cancelled.data["cancellation_reason"], payload["reason"])
        self.assertEqual(cancelled.data["amount_refunded"], Decimal("20.00"))
        self.assertEqual(len(cancelled.data["refunds"]), 2)
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("4.000"),
        )
        self.assertEqual(
            StockMovement.objects.filter(kind=StockMovement.Kind.SALE_REVERSAL).count(),
            1,
        )
        self.assertEqual(
            SaleRefund.objects.filter(original_payment__isnull=False).count(),
            2,
        )
        dashboard = self.client.get("/api/dashboard/", {"period": "daily"})
        self.assertEqual(dashboard.data["summary"]["salesTotal"], Decimal("0.00"))
        self.assertEqual(dashboard.data["summary"]["netSalesTotal"], Decimal("0.00"))
        self.assertEqual(dashboard.data["summary"]["netPayments"], Decimal("0.00"))

    def test_bank_transfer_requires_bank_name_and_availability_accounts_for_reservations(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("3"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        invalid_payment = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-bank-name-required",
                "items": [{"product": self.product.pk, "quantity": 1}],
                "payments": [{"method": "bank_transfer", "amount": "10.00"}],
            },
            format="json",
        )
        self.assertEqual(invalid_payment.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

        transfer_stock(
            source=self.location,
            destination=self.other_location,
            actor=self.manager,
            product=self.product,
            quantity=Decimal("2.000"),
        )
        availability = self.client.get("/api/sales/availability/")
        self.assertEqual(availability.status_code, 200, availability.data)
        product_availability = next(
            item for item in availability.data["products"]
            if item["product"] == self.product.pk
        )
        self.assertEqual(product_availability["available_quantity"], "1.000")

    def test_order_payment_status_tracks_linked_sale_payments(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("2"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        order = self.client.post(
            "/api/orders/",
            {
                "customer_name": "Payment Customer",
                "customer_phone": "000",
                "requested_for": "2030-01-01T10:00:00Z",
                "lines": [{"product": self.product.pk, "quantity": 1}],
                "idempotency_key": "order-payment-001",
            },
            format="json",
        )
        sale = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-order-conversion-001",
                "order": order.data["id"],
                "items": [{"product": self.product.pk, "quantity": 1, "unit_price": "10.00"}],
                "payments": [{"method": "cash", "amount": "5.00"}],
            },
            format="json",
        )
        retry = self.client.post(
            "/api/sales/",
            {
                "idempotency_key": "sale-order-conversion-001",
                "order": order.data["id"],
                "items": [{"product": self.product.pk, "quantity": 1, "unit_price": "10.00"}],
                "payments": [{"method": "cash", "amount": "5.00"}],
            },
            format="json",
        )
        self.assertEqual(sale.status_code, 201, sale.data)
        self.assertEqual(retry.status_code, 201, retry.data)
        self.assertEqual(retry.data["id"], sale.data["id"])
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("1.000"),
        )
        self.assertEqual(self.client.get(f"/api/orders/{order.data['id']}/").data["payment_status"], "partial")

        collected = self.client.post(
            f"/api/sales/{sale.data['id']}/payments/",
            {
                "method": "telebirr",
                "amount": "5.00",
                "idempotency_key": "order-followup-payment-001",
            },
            format="json",
        )
        self.assertEqual(collected.status_code, 201, collected.data)
        self.assertEqual(self.client.get(f"/api/orders/{order.data['id']}/").data["payment_status"], "paid")

    def test_production_consumes_recipe_and_records_finished_stock(self):
        record_stock(
            location=self.location,
            ingredient=self.ingredient,
            quantity_delta=Decimal("5.000"),
            kind=StockMovement.Kind.PURCHASE,
            actor=self.manager,
        )

        response = self.client.post(
            "/api/production/",
            {"product": self.product.pk, "quantity": 2, "idempotency_key": "production-default-001"},
            format="json",
        )
        duplicate = self.client.post(
            "/api/production/",
            {"product": self.product.pk, "quantity": 2, "idempotency_key": "production-default-001"},
            format="json",
        )
        conflicting_retry = self.client.post(
            "/api/production/",
            {"product": self.product.pk, "quantity": 3, "idempotency_key": "production-default-001"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(duplicate.status_code, 201, duplicate.data)
        self.assertEqual(duplicate.data["id"], response.data["id"])
        self.assertEqual(conflicting_retry.status_code, 400)
        self.assertEqual(ProductionBatch.objects.count(), 1)
        self.assertEqual(
            IngredientBalance.objects.get(location=self.location, ingredient=self.ingredient).quantity,
            Decimal("4.500"),
        )
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("2.000"),
        )
        all_waste = self.client.post(
            "/api/production/",
            {
                "product": self.product.pk,
                "quantity": 1,
                "wastage_quantity": 1,
                "wastage_note": "The batch did not set.",
                "idempotency_key": "production-all-waste-001",
            },
            format="json",
        )
        self.assertEqual(all_waste.status_code, 201, all_waste.data)
        self.assertEqual(all_waste.data["finished_quantity"], 0)
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("2.000"),
        )
        self.assertEqual(StockMovement.objects.count(), 4)
        self.assertEqual(
            StockMovement.objects.filter(kind=StockMovement.Kind.PRODUCTION_OUTPUT).count(),
            1,
        )

    def test_production_wastage_is_documented_and_not_added_to_finished_stock(self):
        record_stock(
            location=self.location,
            ingredient=self.ingredient,
            quantity_delta=Decimal("5.000"),
            kind=StockMovement.Kind.PURCHASE,
            actor=self.manager,
        )
        response = self.client.post(
            "/api/production/",
            {
                "product": self.product.pk,
                "quantity": 3,
                "wastage_quantity": 1,
                "wastage_note": "One cake cracked during cooling.",
                "idempotency_key": "production-wastage-001",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["quantity"], 3)
        self.assertEqual(response.data["finished_quantity"], 2)
        self.assertEqual(response.data["wastage_note"], "One cake cracked during cooling.")
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("2.000"),
        )

    def test_production_requirements_show_expected_and_available_ingredients(self):
        record_stock(
            location=self.location,
            ingredient=self.ingredient,
            quantity_delta=Decimal("0.400"),
            kind=StockMovement.Kind.PURCHASE,
            actor=self.manager,
        )
        response = self.client.get(
            "/api/production/requirements/",
            {"product": self.product.pk, "quantity": 2},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["ingredients"][0]["required_quantity"], "0.500")
        self.assertEqual(response.data["ingredients"][0]["available_quantity"], "0.400")
        self.assertFalse(response.data["ingredients"][0]["sufficient"])

    def test_production_insufficient_ingredients_rolls_back_the_batch(self):
        record_stock(
            location=self.location,
            ingredient=self.ingredient,
            quantity_delta=Decimal("0.400"),
            kind=StockMovement.Kind.PURCHASE,
            actor=self.manager,
        )
        response = self.client.post(
            "/api/production/",
            {
                "product": self.product.pk,
                "quantity": 2,
                "idempotency_key": "production-insufficient-001",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ProductionBatch.objects.count(), 0)
        self.assertEqual(
            IngredientBalance.objects.get(location=self.location, ingredient=self.ingredient).quantity,
            Decimal("0.400"),
        )
        self.assertFalse(ProductBalance.objects.filter(location=self.location, product=self.product).exists())

    def test_recipe_versions_and_actual_consumption_are_snapshotted(self):
        record_stock(
            location=self.location,
            ingredient=self.ingredient,
            quantity_delta=Decimal("1.000"),
            kind=StockMovement.Kind.PURCHASE,
            actor=self.manager,
        )
        owner = User.objects.create_user(username="recipe-owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)

        updated = self.client.post(
            "/api/recipes/",
            {
                "product": self.product.pk,
                "ingredients": [{"ingredient": self.ingredient.pk, "quantity": "100", "unit": "g"}],
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 201, updated.data)
        self.assertEqual(updated.data["version"], 2)
        self.recipe.refresh_from_db()
        self.assertFalse(self.recipe.is_current)
        self.assertEqual(self.recipe.ingredients.get().quantity, Decimal("0.250"))

        self.client.force_authenticate(self.manager)
        unexplained = self.client.post(
            "/api/production/",
            {
                "product": self.product.pk,
                "quantity": 2,
                "idempotency_key": "production-unexplained-001",
                "actual_consumption": [
                    {"ingredient": self.ingredient.pk, "quantity": "300", "unit": "g"},
                ],
            },
            format="json",
        )
        self.assertEqual(unexplained.status_code, 400)
        production = self.client.post(
            "/api/production/",
            {
                "product": self.product.pk,
                "quantity": 2,
                "idempotency_key": "production-recipe-001",
                "adjustment_note": "Actual flour use exceeded the current recipe.",
                "actual_consumption": [
                    {"ingredient": self.ingredient.pk, "quantity": "300", "unit": "g"},
                ],
            },
            format="json",
        )
        self.assertEqual(production.status_code, 201, production.data)
        self.assertEqual(production.data["recipe_version"], 2)
        self.assertEqual(production.data["consumptions"][0]["quantity"], "0.300")
        self.assertEqual(
            IngredientBalance.objects.get(location=self.location, ingredient=self.ingredient).quantity,
            Decimal("0.700"),
        )

    def test_unit_conversion_checks_measurement_dimension(self):
        self.assertEqual(convert_quantity(Decimal("1"), "kg", "g"), Decimal("1000.000"))
        with self.assertRaisesMessage(ValidationError, "cannot be converted"):
            convert_quantity(Decimal("1"), "l", "g")

    def test_purchase_approval_is_idempotent_and_posts_stock_once(self):
        BusinessSettings.objects.create(require_purchase_approval=True)
        payload = {
            "idempotency_key": "purchase-request-0001",
            "lines": [
                {"ingredient": self.ingredient.pk, "quantity": "1", "unit": "kg", "unit_cost": "12.50"},
            ],
        }
        first = self.client.post("/api/purchases/", payload, format="json")
        duplicate = self.client.post("/api/purchases/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(duplicate.status_code, 201, duplicate.data)
        self.assertEqual(first.data["id"], duplicate.data["id"])
        self.assertEqual(first.data["status"], IngredientPurchase.Status.PENDING)
        self.assertFalse(
            IngredientBalance.objects.filter(location=self.location, ingredient=self.ingredient).exists(),
        )
        self.assertEqual(
            self.client.post(f"/api/purchases/{first.data['id']}/approve/", {}, format="json").status_code,
            403,
        )

        owner = User.objects.create_user(username="purchase-owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)
        approved = self.client.post(
            f"/api/purchases/{first.data['id']}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["status"], IngredientPurchase.Status.APPROVED)
        self.assertEqual(approved.data["total_cost"], Decimal("12.50"))
        self.assertEqual(
            IngredientBalance.objects.get(location=self.location, ingredient=self.ingredient).quantity,
            Decimal("1.000"),
        )
        duplicate_approval = self.client.post(
            f"/api/purchases/{first.data['id']}/approve/",
            {},
            format="json",
        )
        self.assertEqual(duplicate_approval.status_code, 400)

    def test_order_status_must_follow_allowed_transition(self):
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": "000",
            "requested_for": "2030-01-01T10:00:00Z",
            "lines": [{"product": self.product.pk, "quantity": 1}],
            "idempotency_key": "order-status-001",
        }
        created = self.client.post("/api/orders/", payload, format="json")
        duplicate = self.client.post("/api/orders/", payload, format="json")
        conflicting_retry = self.client.post(
            "/api/orders/",
            {**payload, "customer_phone": "111"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data["order_number"].startswith("SC-"))
        self.assertEqual(duplicate.status_code, 201, duplicate.data)
        self.assertEqual(duplicate.data["id"], created.data["id"])
        self.assertEqual(conflicting_retry.status_code, 400)
        self.assertEqual(CustomerOrder.objects.count(), 1)

        invalid = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {"status": CustomerOrder.Status.COMPLETED},
            format="json",
        )
        valid = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {"status": CustomerOrder.Status.CONFIRMED},
            format="json",
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200, valid.data)
        self.assertEqual(len(valid.data["status_history"]), 2)

    def test_public_website_order_enters_owner_assignment_queue(self):
        self.product.web_id = "vanilla-custard"
        self.product.save(update_fields=["web_id"])
        public_client = APIClient()

        response = public_client.post(
            "/orders",
            {
                "customerName": "Website Customer",
                "phone": "0911000000",
                "email": "customer@example.com",
                "cakeId": "vanilla-custard",
                "size": "Medium",
                "quantity": 2,
                "instructions": "Please call before confirming.",
                "fulfillment": "pickup",
                "requestedDate": "2030-01-01",
                "idempotencyKey": "website-order-001",
            },
            format="json",
        )
        duplicate = public_client.post(
            "/orders",
            {
                "customerName": "Website Customer",
                "phone": "0911000000",
                "email": "customer@example.com",
                "cakeId": "vanilla-custard",
                "size": "Medium",
                "quantity": 2,
                "instructions": "Please call before confirming.",
                "fulfillment": "pickup",
                "requestedDate": "2030-01-01",
                "idempotencyKey": "website-order-001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(duplicate.status_code, 201, duplicate.data)
        self.assertEqual(duplicate.data["id"], response.data["id"])
        self.assertEqual(CustomerOrder.objects.count(), 1)
        self.assertTrue(response.data["orderNumber"].startswith("SC-"))
        order = CustomerOrder.objects.get(pk=response.data["id"])
        self.assertIsNone(order.location)
        self.assertEqual(order.source, CustomerOrder.Source.WEBSITE)
        self.assertEqual(order.customer_email, "customer@example.com")
        self.assertEqual(order.lines.get().quantity, 2)

        owner = User.objects.create_user(username="owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)
        assigned = self.client.patch(
            f"/api/orders/{order.pk}/",
            {"location": self.location.pk},
            format="json",
        )

        self.assertEqual(assigned.status_code, 200, assigned.data)
        order.refresh_from_db()
        self.assertEqual(order.location, self.location)
        history = self.client.get("/api/audit/")
        self.assertEqual(history.status_code, 200, history.data)
        website_order_event = next(
            event for event in history.data["results"]
            if event["target_id"] == str(order.pk) and event["action"] == "website_order"
        )
        self.assertEqual(website_order_event["actor_name"], "System")

    def test_public_order_requires_a_configured_product_mapping(self):
        response = APIClient().post(
            "/orders/",
            {
                "customerName": "Website Customer",
                "phone": "0911000000",
                "cakeId": "not-configured",
                "size": "Medium",
                "quantity": 1,
                "fulfillment": "pickup",
                "requestedDate": "2030-01-01",
                "idempotencyKey": "website-order-invalid-product",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(CustomerOrder.objects.count(), 0)

    def test_owner_transfer_moves_stock_between_locations_atomically(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("3"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        owner = User.objects.create_user(username="owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)

        response = self.client.post(
            "/api/transfers/",
            {
                "source_location": self.location.pk,
                "destination_location": self.other_location.pk,
                "product": self.product.pk,
                "quantity": "2.000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("3.000"),
        )
        self.assertEqual(
            ProductBalance.objects.filter(location=self.other_location, product=self.product).count(),
            0,
        )
        self.assertEqual(response.data["status"], "in_transit")
        self.assertEqual(response.data["remaining_quantity"], "2.000")
        self.assertEqual(StockMovement.objects.count(), 1)

        duplicate_dispatch = self.client.post(
            "/api/transfers/",
            {
                "source_location": self.location.pk,
                "destination_location": self.other_location.pk,
                "product": self.product.pk,
                "quantity": "2.000",
            },
            format="json",
        )
        self.assertEqual(duplicate_dispatch.status_code, 400)

        receiver = User.objects.create_user(
            username="cafe-employee",
            role=User.Role.EMPLOYEE,
            workspace=User.Workspace.CAFE,
            location=self.other_location,
        )
        self.client.force_authenticate(receiver)
        received = self.client.post(
            f"/api/transfers/{response.data['id']}/receive/",
            {
                "quantity": "1.000",
                "is_final": False,
                "idempotency_key": "transfer-receipt-001",
            },
            format="json",
        )
        self.assertEqual(received.status_code, 200, received.data)
        self.assertEqual(received.data["status"], "partially_received")
        self.assertEqual(received.data["received_quantity"], "1.000")
        self.assertEqual(received.data["remaining_quantity"], "1.000")
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("2.000"),
        )
        self.assertEqual(
            ProductBalance.objects.get(location=self.other_location, product=self.product).quantity,
            Decimal("1.000"),
        )
        duplicate_receipt = self.client.post(
            f"/api/transfers/{response.data['id']}/receive/",
            {
                "quantity": "1.000",
                "is_final": False,
                "idempotency_key": "transfer-receipt-001",
            },
            format="json",
        )
        self.assertEqual(duplicate_receipt.status_code, 200, duplicate_receipt.data)
        self.assertEqual(StockTransferReceipt.objects.count(), 1)
        final_receipt = self.client.post(
            f"/api/transfers/{response.data['id']}/receive/",
            {
                "quantity": "0",
                "is_final": True,
                "discrepancy_note": "One cake was missing from the delivery.",
                "idempotency_key": "transfer-receipt-002",
            },
            format="json",
        )
        self.assertEqual(final_receipt.status_code, 200, final_receipt.data)
        self.assertEqual(final_receipt.data["status"], "received")
        self.assertEqual(final_receipt.data["receipts"][1]["discrepancy_quantity"], "1.000")
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("1.000"),
        )
        transfer = StockTransfer.objects.get(pk=response.data["id"])
        self.assertEqual(transfer.received_by, receiver)
        self.assertIsNotNone(transfer.received_at)
        self.assertEqual(StockMovement.objects.count(), 4)

    def test_multi_cake_shipment_is_atomic_and_idempotent(self):
        second_product = CakeProduct.objects.create(name="Second Cake", sku="SECOND-CAKE")
        for product in (self.product, second_product):
            record_stock(
                location=self.location,
                product=product,
                quantity_delta=Decimal("3"),
                kind=StockMovement.Kind.PRODUCTION_OUTPUT,
                actor=self.manager,
            )
        owner = User.objects.create_user(username="shipment-owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)
        payload = {
            "source_location": self.location.pk,
            "destination_location": self.other_location.pk,
            "idempotency_key": "shipment-batch-001",
            "items": [
                {"product": self.product.pk, "quantity": "1.000"},
                {"product": second_product.pk, "quantity": "2.000"},
            ],
        }

        first = self.client.post("/api/transfers/dispatch/", payload, format="json")
        retry = self.client.post("/api/transfers/dispatch/", payload, format="json")

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(retry.status_code, 201, retry.data)
        self.assertEqual([item["id"] for item in retry.data], [item["id"] for item in first.data])
        self.assertEqual(TransferShipment.objects.count(), 1)
        self.assertEqual(StockTransfer.objects.count(), 2)
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("3.000"),
        )
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=second_product).quantity,
            Decimal("3.000"),
        )

    def test_audit_history_requires_permission_and_scopes_staff_to_location(self):
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("2"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        self.manager.business_permissions = ["audit"]
        self.manager.save(update_fields=["business_permissions"])

        self.client.force_authenticate(self.manager)
        scoped = self.client.get("/api/audit/")
        self.assertEqual(scoped.status_code, 200, scoped.data)
        self.assertEqual(len(scoped.data["results"]), 1)
        self.assertEqual(scoped.data["results"][0]["location"], self.location.pk)

        owner = User.objects.create_user(username="owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)
        owner_history = self.client.get("/api/audit/")
        self.assertEqual(owner_history.status_code, 200, owner_history.data)
        self.assertEqual(len(owner_history.data["results"]), 1)

        self.manager.business_permissions = []
        self.manager.save(update_fields=["business_permissions"])
        self.client.force_authenticate(self.manager)
        denied = self.client.get("/api/audit/")
        self.assertEqual(denied.status_code, 403)

    def test_staff_business_permissions_are_enforced_by_api(self):
        employee = User.objects.create_user(
            username="bakery-employee",
            role=User.Role.EMPLOYEE,
            workspace=User.Workspace.BAKERY,
            location=self.location,
        )
        self.client.force_authenticate(employee)

        permitted = self.client.get("/api/production/")
        forbidden = self.client.get("/api/sales/")
        adjustment = self.client.post(
            "/api/inventory/adjustments/",
            {"ingredient": self.ingredient.pk, "quantity_delta": "1.000", "note": "Count correction"},
            format="json",
        )

        self.assertEqual(permitted.status_code, 200)
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(adjustment.status_code, 403)

    def test_inventory_lists_unreceived_items_as_zero_and_dashboard_alerts(self):
        response = self.client.get("/api/inventory/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["ingredients"][0]["quantity"], "0.000")
        self.assertEqual(response.data["products"][0]["quantity"], "0.000")

        dashboard = self.client.get("/api/dashboard/")
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertEqual(dashboard.data["summary"]["lowIngredientBalances"], 1)

    def test_purchase_converts_input_unit_to_inventory_unit(self):
        response = self.client.post(
            "/api/purchases/",
            {
                "idempotency_key": "purchase-grams-0001",
                "lines": [
                    {"ingredient": self.ingredient.pk, "quantity": "500", "unit": "g", "unit_cost": "8.00"},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["received_lines"][0]["stock_quantity"], "0.500")
        self.assertEqual(
            IngredientBalance.objects.get(location=self.location, ingredient=self.ingredient).quantity,
            Decimal("0.500"),
        )

    def test_dashboard_hides_financial_reports_from_employee(self):
        employee = User.objects.create_user(
            username="cafe-employee",
            role=User.Role.EMPLOYEE,
            workspace=User.Workspace.CAFE,
            location=self.location,
        )
        self.client.force_authenticate(employee)

        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("salesTotal", response.data["summary"])
        self.assertNotIn("cashCollected", response.data["summary"])
        self.assertNotIn("recentActivity", response.data)

    def test_owner_can_open_staff_admin_create_form(self):
        owner = User.objects.create_superuser(
            username="admin-owner",
            password="test-password-123",
        )
        client = Client()
        client.force_login(owner)

        response = client.get("/admin/seasonops/user/add/")

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(BusinessUserCreationForm(), BusinessUserCreationForm)
        self.assertContains(response, "Use role/workspace defaults")

    def test_staff_cannot_assign_customer_orders_to_other_locations(self):
        created = self.client.post(
            "/api/orders/",
            {
                "customer_name": "Test Customer",
                "customer_phone": "000",
                "requested_for": "2030-01-01T10:00:00Z",
                "lines": [{"product": self.product.pk, "quantity": 1}],
                "idempotency_key": "order-scope-001",
            },
            format="json",
        )

        response = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {"location": self.other_location.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_login_requires_csrf_and_creates_session(self):
        client = Client(enforce_csrf_checks=True)
        anonymous_session = client.get("/api/auth/me/")
        self.assertEqual(anonymous_session.status_code, 200)
        self.assertEqual(anonymous_session.json(), {"authenticated": False})

        csrf = client.get("/api/auth/csrf/")
        missing_csrf = client.post(
            "/api/auth/login/",
            {"username": "manager", "password": "test-password-123"},
            content_type="application/json",
        )
        self.assertEqual(missing_csrf.status_code, 403)

        response = client.post(
            "/api/auth/login/",
            {"username": "manager", "password": "test-password-123"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf.json()["csrfToken"],
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["role"], User.Role.MANAGER)
        self.assertEqual(client.get("/api/auth/me/").status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(actor__username="manager", action="login").exists())
        signed_out = client.post(
            "/api/auth/logout/",
            {},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=response.json()["csrfToken"],
        )
        self.assertEqual(signed_out.status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(actor__username="manager", action="logout").exists())

    def test_customer_order_pricing_and_advance_deposit_without_stock(self):
        # 1. Ensure product balance is 0
        ProductBalance.objects.filter(location=self.location, product=self.product).update(quantity=Decimal("0.000"))

        # 2. Create customer order with custom unit price
        order_res = self.client.post(
            "/api/orders/",
            {
                "customer_name": "Sarah Miller",
                "customer_phone": "+251911000111",
                "customer_email": "sarah@example.com",
                "requested_for": "2030-05-10T14:00:00Z",
                "lines": [
                    {"product": self.product.pk, "quantity": 1, "size": "10-inch Custom", "unit_price": "850.00"}
                ],
                "idempotency_key": "order-deposit-test-001",
            },
            format="json",
        )
        self.assertEqual(order_res.status_code, 201, order_res.data)
        order_id = order_res.data["id"]
        self.assertEqual(Decimal(str(order_res.data["total"])), Decimal("850.00"))
        self.assertEqual(Decimal(str(order_res.data["amount_paid"])), Decimal("0.00"))
        self.assertEqual(order_res.data["payment_status"], "unpaid")

        # 3. Customer pays an advance deposit of 300 via Telebirr without physical cake in stock
        pay_res = self.client.post(
            f"/api/orders/{order_id}/payments/",
            {
                "method": "telebirr",
                "amount": "300.00",
                "idempotency_key": "order-deposit-pay-001",
            },
            format="json",
        )
        self.assertEqual(pay_res.status_code, 201, pay_res.data)
        self.assertEqual(Decimal(str(pay_res.data["amount"])), Decimal("300.00"))

        order_get = self.client.get(f"/api/orders/{order_id}/")
        self.assertEqual(order_get.data["payment_status"], "partial")
        self.assertEqual(Decimal(str(order_get.data["amount_paid"])), Decimal("300.00"))
        self.assertEqual(Decimal(str(order_get.data["amount_due"])), Decimal("550.00"))

        # 4. Idempotency replay of same payment
        pay_replay = self.client.post(
            f"/api/orders/{order_id}/payments/",
            {
                "method": "telebirr",
                "amount": "300.00",
                "idempotency_key": "order-deposit-pay-001",
            },
            format="json",
        )
        self.assertEqual(pay_replay.status_code, 201)
        self.assertEqual(Decimal(str(pay_replay.data["amount"])), Decimal("300.00"))

        # 5. Overpayment beyond due amount is rejected
        pay_excess = self.client.post(
            f"/api/orders/{order_id}/payments/",
            {
                "method": "cash",
                "amount": "600.00",
                "idempotency_key": "order-deposit-excess-001",
            },
            format="json",
        )
        self.assertEqual(pay_excess.status_code, 400)

        # 6. Verify inventory balance is STILL 0 (advance payment does NOT require or deduct stock)
        bal = ProductBalance.objects.filter(location=self.location, product=self.product).first()
        self.assertEqual(bal.quantity if bal else Decimal("0"), Decimal("0"))

        # 7. Bakery confirms, produces and marks order ready
        self.assertEqual(
            self.client.patch(f"/api/orders/{order_id}/", {"status": "confirmed"}, format="json").status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(f"/api/orders/{order_id}/", {"status": "in_production"}, format="json").status_code,
            200,
        )
        record_stock(
            location=self.location,
            product=self.product,
            quantity_delta=Decimal("1"),
            kind=StockMovement.Kind.PRODUCTION_OUTPUT,
            actor=self.manager,
        )
        ready_res = self.client.patch(
            f"/api/orders/{order_id}/",
            {"status": "ready"},
            format="json",
        )
        self.assertEqual(ready_res.status_code, 200, ready_res.data)

        # 8. Settle the order at pickup: create sale linking order and paying remaining 550 via cash
        sale_res = self.client.post(
            "/api/sales/",
            {
                "order": order_id,
                "items": [{"product": self.product.pk, "quantity": 1}],
                "payments": [{"method": "cash", "amount": "550.00"}],
                "idempotency_key": "order-settle-sale-001",
            },
            format="json",
        )
        self.assertEqual(sale_res.status_code, 201, sale_res.data)

        # 9. Verify order is now completed and fully paid
        order = CustomerOrder.objects.get(pk=order_id)
        self.assertEqual(order.status, CustomerOrder.Status.COMPLETED)
        self.assertEqual(order.payment_status, "paid")
        self.assertEqual(order.amount_paid, Decimal("850.00"))

        # 10. Verify stock was deducted exactly once (1 - 1 = 0)
        self.assertEqual(
            ProductBalance.objects.get(location=self.location, product=self.product).quantity,
            Decimal("0.000"),
        )
        # 11. Verify deposit payment was linked to sale
        deposit_payment = Payment.objects.get(idempotency_key="order-deposit-pay-001")
        self.assertEqual(deposit_payment.sale_id, sale_res.data["id"])

    def test_owner_staff_management_endpoints(self):
        owner = User.objects.create_user(username="staff-mgmt-owner", role=User.Role.OWNER)
        self.client.force_authenticate(owner)

        # 1. Owner lists staff
        res = self.client.get("/api/v1/staff/")
        self.assertEqual(res.status_code, 200)

        # 2. Owner creates new employee
        create_res = self.client.post(
            "/api/v1/staff/",
            {
                "username": "new-baker",
                "first_name": "Abebe",
                "last_name": "Kebede",
                "email": "abebe@seasonscake.com",
                "role": "employee",
                "workspace": "bakery",
                "location": self.location.pk,
                "password": "BakerSecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, 201, create_res.data)
        baker_id = create_res.data["id"]
        baker = User.objects.get(pk=baker_id)
        self.assertEqual(baker.first_name, "Abebe")
        self.assertEqual(baker.workspace, "bakery")
        self.assertTrue(baker.check_password("BakerSecurePassword123!"))

        # 3. Owner updates employee
        update_res = self.client.patch(
            f"/api/v1/staff/{baker_id}/",
            {"first_name": "Abebe Updated", "role": "manager"},
            format="json",
        )
        self.assertEqual(update_res.status_code, 200, update_res.data)
        baker.refresh_from_db()
        self.assertEqual(baker.first_name, "Abebe Updated")
        self.assertEqual(baker.role, "manager")

        # 4. Non-owner without permission is rejected
        employee = User.objects.create_user(
            username="unauthorized-emp",
            role=User.Role.EMPLOYEE,
            location=self.location,
            business_permissions=[],
        )
        self.client.force_authenticate(employee)
        forbidden_res = self.client.get("/api/v1/staff/")
        self.assertEqual(forbidden_res.status_code, 403)

        # 5. Owner deactivates employee
        self.client.force_authenticate(owner)
        delete_res = self.client.delete(f"/api/v1/staff/{baker_id}/")
        self.assertEqual(delete_res.status_code, 204)
        baker.refresh_from_db()
        self.assertFalse(baker.is_active)

        # 6. Owner cannot delete self
        self_delete_res = self.client.delete(f"/api/v1/staff/{owner.pk}/")
        self.assertEqual(self_delete_res.status_code, 400)
