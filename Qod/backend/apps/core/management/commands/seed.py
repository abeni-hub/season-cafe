"""Seed demo data that mirrors the frontend's local demo dataset.

Passwords are never hardcoded: supply ``SEED_PASSWORD`` (or ``--password``) or a
random password is generated and printed once.
"""

import os
import secrets
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.audit.models import Activity
from apps.core.models import BusinessSettings, CodeSequence
from apps.customers.models import Customer, CustomerKind
from apps.expenses.models import Expense, ExpenseCategory
from apps.inventory.models import InventoryItem, ItemKind, StockMovement, Unit
from apps.inventory.services import add_movement
from apps.orders.models import Order, OrderItem, OrderSource, OrderStatus, OrderType
from apps.payments.models import Payment, PaymentKind, PaymentRole
from apps.production.models import BatchStatus, ProductionBatch
from apps.products.constants import SEVEN_PRODUCTS
from apps.products.models import Product
from apps.purchasing.models import (
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    SupplierPayment,
)
from apps.recipes.models import Recipe, RecipeLine
from apps.suppliers.models import Supplier
from apps.transfers.models import Transfer, TransferLine, TransferStatus
from apps.website.models import Message, SiteContent

DEMO_PASSWORD_EMAILS = [
    "owner@seasonscake.demo",
    "admin@seasonscake.demo",
    "manager@seasonscake.demo",
    "cashier@seasonscake.demo",
    "production@seasonscake.demo",
    "inventory@seasonscake.demo",
]

DEMO_STAFF = [
    ("Demo Owner", "owner@seasonscake.demo", Role.OWNER),
    ("Demo Administrator", "admin@seasonscake.demo", Role.ADMIN),
    ("Demo Manager", "manager@seasonscake.demo", Role.MANAGER),
    ("Demo Cashier", "cashier@seasonscake.demo", Role.CASHIER),
    ("Demo Baker", "production@seasonscake.demo", Role.PRODUCTION),
    ("Demo Storekeeper", "inventory@seasonscake.demo", Role.INVENTORY),
]

OPENING_STOCK = [
    ("ing_flour", "home_bakery", 80),
    ("ing_sugar", "home_bakery", 60),
    ("ing_butter", "home_bakery", 40),
    ("ing_eggs", "home_bakery", 600),
    ("ing_milk", "home_bakery", 60),
    ("ing_cream", "home_bakery", 45),
    ("ing_chocolate", "home_bakery", 30),
    ("ing_cocoa", "home_bakery", 10),
    ("ing_coffee", "home_bakery", 5),
    ("ing_vanilla", "home_bakery", 6),
    ("ing_strawberry", "home_bakery", 18),
    ("ing_puff", "home_bakery", 25),
    ("pkg_cakebox", "home_bakery", 300),
    ("pkg_tartbox", "home_bakery", 240),
    ("pkg_bag", "home_bakery", 500),
    ("fin_vanilla", "home_bakery", 10),
    ("fin_chocolate", "home_bakery", 8),
    ("fin_mocha", "home_bakery", 6),
    ("fin_mille", "home_bakery", 4),
    ("fin_creampuff", "home_bakery", 30),
    ("fin_strawberry_tart", "home_bakery", 8),
    ("fin_choc_tart", "home_bakery", 6),
    ("pkg_cakebox", "cafe", 80),
    ("pkg_tartbox", "cafe", 60),
    ("pkg_bag", "cafe", 200),
    ("fin_vanilla", "cafe", 6),
    ("fin_chocolate", "cafe", 5),
    ("fin_mocha", "cafe", 12),
    ("fin_mille", "cafe", 2),
    ("fin_creampuff", "cafe", 40),
    ("fin_strawberry_tart", "cafe", 4),
    ("fin_choc_tart", "cafe", 4),
]

RECIPES = {
    "vanilla-custard": {
        "yield": 8,
        "notes": "Demo recipe. Custard set in tart shells, eight per batch.",
        "lines": [
            ("ing_milk", 2),
            ("ing_cream", 1),
            ("ing_sugar", 0.6),
            ("ing_eggs", 12),
            ("ing_vanilla", 0.05),
            ("pkg_tartbox", 8),
        ],
    },
    "chocolate-custard": {
        "yield": 8,
        "notes": "",
        "lines": [
            ("ing_milk", 2),
            ("ing_cream", 1),
            ("ing_sugar", 0.5),
            ("ing_eggs", 12),
            ("ing_chocolate", 0.8),
            ("ing_cocoa", 0.1),
            ("pkg_tartbox", 8),
        ],
    },
    "mocha": {
        "yield": 8,
        "notes": "",
        "lines": [
            ("ing_milk", 2),
            ("ing_cream", 1),
            ("ing_sugar", 0.5),
            ("ing_eggs", 12),
            ("ing_coffee", 0.08),
            ("ing_cocoa", 0.12),
            ("pkg_tartbox", 8),
        ],
    },
    "mille-feuille": {
        "yield": 4,
        "notes": "",
        "lines": [
            ("ing_puff", 1.5),
            ("ing_cream", 1),
            ("ing_sugar", 0.4),
            ("ing_milk", 0.5),
            ("pkg_cakebox", 4),
        ],
    },
    "cream-puffs": {
        "yield": 6,
        "notes": "",
        "lines": [
            ("ing_puff", 1),
            ("ing_cream", 1.2),
            ("ing_eggs", 6),
            ("ing_sugar", 0.3),
            ("pkg_tartbox", 6),
        ],
    },
    "strawberry-tart": {
        "yield": 6,
        "notes": "",
        "lines": [
            ("ing_puff", 0.8),
            ("ing_cream", 0.8),
            ("ing_strawberry", 1.2),
            ("ing_sugar", 0.2),
            ("pkg_tartbox", 6),
        ],
    },
    "chocolate-tart": {
        "yield": 6,
        "notes": "",
        "lines": [
            ("ing_puff", 0.8),
            ("ing_chocolate", 0.9),
            ("ing_cream", 0.7),
            ("pkg_tartbox", 6),
        ],
    },
}


def days_ago(days, hours=0, minutes=0):
    return timezone.now() - timedelta(days=days, hours=hours, minutes=minutes)


def stamp(obj, **fields):
    """Rewrite auto_now/auto_now_add fields after creation."""
    type(obj).objects.filter(pk=obj.pk).update(**fields)
    for key, value in fields.items():
        setattr(obj, key, value)
    return obj


class Command(BaseCommand):
    help = "Seed the database with the demo catalogue, ledgers and staff accounts."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=None, help="Password for all demo accounts.")
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete seeded demo data and demo staff before seeding again.",
        )

    def handle(self, *args, **options):
        password = options["password"] or os.environ.get("SEED_PASSWORD")
        generated = False
        if not password:
            password = secrets.token_urlsafe(12)
            generated = True
        if len(password) < 8:
            raise CommandError("Seed password must be at least 8 characters.")

        reset = options["reset"]
        if Order.objects.exists() or InventoryItem.objects.exists():
            if not reset:
                raise CommandError(
                    "The database already contains bakery data. "
                    "Re-run with --reset to replace the demo dataset."
                )

        with transaction.atomic():
            if reset:
                self._reset()

            opened = days_ago(30, 8, 0)
            users = self._create_staff(password)
            owner = users["owner@seasonscake.demo"]
            manager = users["manager@seasonscake.demo"]
            production = users["production@seasonscake.demo"]
            inventory_staff = users["inventory@seasonscake.demo"]
            cashier = users["cashier@seasonscake.demo"]

            BusinessSettings.objects.update_or_create(
                pk=1,
                defaults={
                    "business_name": "Seasons Cake",
                    "currency": "NGN",
                    "tagline": "Delicious & Fresh",
                },
            )
            content = SiteContent.load()
            content.hero_eyebrow = "Botanical patisserie"
            content.hero_title = "Baked with the seasons"
            content.hero_lead = (
                "Custards, mille-feuille and tarts made fresh at our home bakery — served at "
                "the counter and finished by hand."
            )
            content.about_title = "A bakery built around freshness"
            content.about_lead = (
                "Seasons Cake is a botanical patisserie working from a home bakery, with a café "
                "counter for the everyday bake."
            )
            content.about_body = (
                "Our catalogue stays deliberately small: seven bakes we can make well, every "
                "single day. Fruit follows the season, cream is whipped to order, and pastry is "
                "baked in small batches. For celebrations, corporate gifting and larger "
                "gatherings we take custom and organisational orders with a written quotation."
            )
            content.custom_order_note = (
                "Share the occasion, headcount and any style references. We will respond with "
                "availability and a written quotation; no payment is taken through this form."
            )
            content.contact_phone = ""
            content.contact_email = ""
            content.contact_address = ""
            content.opening_hours = ""
            content.gallery_captions = [
                "Counter bake — demo caption",
                "Botanical palette — demo caption",
                "Custard finish — demo caption",
                "Pastry layers — demo caption",
                "Celebration cake — demo caption",
                "Seasonal fruit — demo caption",
            ]
            content.save()

            products = self._create_products()
            items = self._create_inventory(products)

            for key, location, qty in OPENING_STOCK:
                self._move(
                    items[key], location, qty, "opening", opened, None, "Opening balance (demo data)"
                )

            customers = self._create_customers()

            self._create_pos_orders(products, customers, cashier)
            self._create_management_orders(customers, manager)

            self._move(
                items["fin_creampuff"],
                "home_bakery",
                -6,
                "transfer_out",
                days_ago(4, 8, 0),
                None,
                "Transfer TRF-6001",
            )
            self._move(
                items["fin_creampuff"],
                "cafe",
                6,
                "transfer_in",
                days_ago(4, 11, 0),
                None,
                "Transfer TRF-6001",
            )

            supplier_aurora, supplier_green = self._create_purchasing(
                items, inventory_staff
            )
            self._create_transfers(items, inventory_staff)

            self._create_recipes(products, items)
            self._create_batches(products, production)
            self._create_expenses(manager)

            Message.objects.create(
                name="Demo Website Visitor",
                email="visitor@seasonscake.demo",
                phone="000 000 0002",
                subject="Event enquiry",
                body=(
                    "Hello — I would like to discuss a cake for an office event. Could someone "
                    "share the custom order process? (demo message)"
                ),
                is_read=False,
            )

            Activity.objects.create(
                message="Demo data initialised with catalogue, ledgers and opening stock.",
                actor_label="System",
                created_at=opened,
            )
            Activity.objects.create(
                message=(
                    "Deposit of ₦90,000 recorded for ORD-2001 (financial event only — no stock "
                    "movement)."
                ),
                actor=manager,
                actor_label=manager.name,
                created_at=days_ago(8, 10, 0),
            )
            Activity.objects.create(
                message="Production batch BATCH-7002 started for Brightline Demo Ltd.",
                actor=production,
                actor_label=production.name,
                created_at=days_ago(0, 8, 0),
            )

            positions = {
                "pos": 1007,
                "order": 2003,
                "inquiry": 3001,
                "po": 5002,
                "batch": 7003,
                "transfer": 6002,
                "sku_raw": 12,
                "sku_packaging": 3,
            }
            for key, value in positions.items():
                CodeSequence.objects.update_or_create(key=key, defaults={"value": value})

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        if generated:
            self.stdout.write(
                self.style.WARNING(
                    "Generated demo password (shown once): " + password
                )
            )
            self.stdout.write(
                "Demo accounts: " + ", ".join(DEMO_PASSWORD_EMAILS)
            )
        else:
            self.stdout.write("Demo accounts use the supplied seed password.")

    # ------------------------------------------------------------------ reset

    def _reset(self):
        Message.objects.all().delete()
        Activity.objects.all().delete()
        Expense.objects.all().delete()
        TransferLine.objects.all().delete()
        Transfer.objects.all().delete()
        ProductionBatch.objects.all().delete()
        SupplierPayment.objects.all().delete()
        PurchaseReceiptLine.objects.all().delete()
        PurchaseReceipt.objects.all().delete()
        PurchaseOrderLine.objects.all().delete()
        PurchaseOrder.objects.all().delete()
        RecipeLine.objects.all().delete()
        Recipe.objects.all().delete()
        Payment.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        StockMovement.objects.all().delete()
        InventoryItem.objects.all().delete()
        Supplier.objects.all().delete()
        Customer.objects.all().delete()
        Product.objects.all().delete()
        CodeSequence.objects.all().delete()
        User.objects.filter(email__in=DEMO_PASSWORD_EMAILS).delete()
        self.stdout.write("Cleared previous demo data.")

    # ------------------------------------------------------------------ staff

    def _create_staff(self, password):
        users = {}
        for name, email, role in DEMO_STAFF:
            user, _ = User.objects.update_or_create(
                email=email,
                defaults={
                    "name": name,
                    "role": role,
                    "is_active": True,
                    "is_staff": role == Role.OWNER,
                    "is_superuser": role == Role.OWNER,
                },
            )
            user.set_password(password)
            user.save()
            users[email] = user
        return users

    # --------------------------------------------------------------- catalogue

    def _create_products(self):
        products = {}
        for spec in SEVEN_PRODUCTS:
            product, _ = Product.objects.update_or_create(
                slug=spec["slug"],
                defaults={
                    "name": spec["name"],
                    "tagline": spec["tagline"],
                    "description": spec["description"],
                    "price_cents": spec["price_cents"],
                    "is_published": True,
                    "is_available": True,
                    "art_index": spec["art_index"],
                    "sort_order": spec["sort_order"],
                },
            )
            products[spec["slug"]] = product
        return products

    def _create_inventory(self, products):
        rows = [
            ("ing_flour", "RM-001", "Plain flour", ItemKind.RAW, Unit.KG, 120000, 20, None),
            ("ing_sugar", "RM-002", "Caster sugar", ItemKind.RAW, Unit.KG, 150000, 15, None),
            ("ing_butter", "RM-003", "Unsalted butter", ItemKind.RAW, Unit.KG, 320000, 10, None),
            ("ing_eggs", "RM-004", "Eggs", ItemKind.RAW, Unit.PCS, 25000, 120, None),
            ("ing_milk", "RM-005", "Whole milk", ItemKind.RAW, Unit.L, 180000, 20, None),
            ("ing_cream", "RM-006", "Whipping cream", ItemKind.RAW, Unit.L, 450000, 10, None),
            ("ing_chocolate", "RM-007", "Dark chocolate", ItemKind.RAW, Unit.KG, 480000, 8, None),
            ("ing_cocoa", "RM-008", "Cocoa powder", ItemKind.RAW, Unit.KG, 520000, 4, None),
            ("ing_coffee", "RM-009", "Espresso powder", ItemKind.RAW, Unit.KG, 600000, 2, None),
            ("ing_vanilla", "RM-010", "Vanilla extract", ItemKind.RAW, Unit.L, 900000, 2, None),
            ("ing_strawberry", "RM-011", "Fresh strawberries", ItemKind.RAW, Unit.KG, 350000, 6, None),
            ("ing_puff", "RM-012", "Puff pastry", ItemKind.RAW, Unit.KG, 300000, 8, None),
            ("pkg_cakebox", "PK-001", "Cake box (large)", ItemKind.PACKAGING, Unit.PCS, 40000, 50, None),
            ("pkg_tartbox", "PK-002", "Tart box", ItemKind.PACKAGING, Unit.PCS, 25000, 60, None),
            ("pkg_bag", "PK-003", "Paper bag", ItemKind.PACKAGING, Unit.PCS, 15000, 100, None),
            ("fin_vanilla", "FG-001", "Vanilla Custard (finished)", ItemKind.FINISHED, Unit.PCS, 210000, 6, "vanilla-custard"),
            ("fin_chocolate", "FG-002", "Chocolate Custard (finished)", ItemKind.FINISHED, Unit.PCS, 235000, 6, "chocolate-custard"),
            ("fin_mocha", "FG-003", "Mocha (finished)", ItemKind.FINISHED, Unit.PCS, 245000, 6, "mocha"),
            ("fin_mille", "FG-004", "Mille-feuille (finished)", ItemKind.FINISHED, Unit.PCS, 290000, 4, "mille-feuille"),
            ("fin_creampuff", "FG-005", "Cream Puffs (finished)", ItemKind.FINISHED, Unit.PCS, 150000, 12, "cream-puffs"),
            ("fin_strawberry_tart", "FG-006", "Strawberry Tart (finished)", ItemKind.FINISHED, Unit.PCS, 200000, 5, "strawberry-tart"),
            ("fin_choc_tart", "FG-007", "Chocolate Tart (finished)", ItemKind.FINISHED, Unit.PCS, 210000, 5, "chocolate-tart"),
        ]
        items = {}
        for key, sku, name, kind, unit, cost, reorder, slug in rows:
            item, _ = InventoryItem.objects.update_or_create(
                sku=sku,
                defaults={
                    "name": name,
                    "kind": kind,
                    "unit": unit,
                    "cost_per_unit_cents": cost,
                    "reorder_level": Decimal(reorder),
                    "product": products[slug] if slug else None,
                    "is_active": True,
                },
            )
            items[key] = item
        return items

    # --------------------------------------------------------------- customers

    def _create_customers(self):
        walkin, _ = Customer.objects.update_or_create(
            is_walkin=True,
            defaults={
                "kind": CustomerKind.INDIVIDUAL,
                "name": "Walk-in customer",
            },
        )
        individual, _ = Customer.objects.update_or_create(
            email="customer@seasonscake.demo",
            defaults={
                "kind": CustomerKind.INDIVIDUAL,
                "name": "Demo Customer — Individual",
                "phone": "000 000 0000",
                "notes": "Demo record. Replace with a real customer profile.",
            },
        )
        brightline, _ = Customer.objects.update_or_create(
            email="orders@brightline.demo",
            defaults={
                "kind": CustomerKind.ORGANIZATION,
                "name": "Brightline Demo Ltd",
                "organization": "Brightline Demo Ltd",
                "phone": "000 000 0001",
                "notes": "Demo corporate account.",
            },
        )
        website, _ = Customer.objects.update_or_create(
            email="visitor@seasonscake.demo",
            defaults={
                "kind": CustomerKind.INDIVIDUAL,
                "name": "Demo Website Visitor",
                "notes": "Created from the website custom-order form (demo).",
            },
        )
        now = timezone.now()
        stamp(individual, created_at=now - timedelta(days=21))
        stamp(brightline, created_at=now - timedelta(days=16))
        stamp(website, created_at=now - timedelta(days=1))
        return {
            "walkin": walkin,
            "individual": individual,
            "brightline": brightline,
            "website": website,
        }

    # ---------------------------------------------------------------- movements

    def _move(self, item, location, delta, reason, when, ref_id, note, actor=None, event_id=None):
        movement = add_movement(
            item,
            location,
            Decimal(str(delta)),
            reason,
            ref_id=ref_id,
            event_id=event_id,
            note=note,
            actor=actor,
        )
        stamp(movement, created_at=when)
        return movement

    # ------------------------------------------------------------------ orders

    def _make_order(
        self,
        *,
        code,
        at,
        order_type,
        status,
        source,
        customer,
        items,
        location="home_bakery",
        delivery_location="",
        delivery_date=None,
        notes="",
        created_by=None,
    ):
        order = Order.objects.create(
            code=code,
            type=order_type,
            status=status,
            source=source,
            customer=customer,
            location=location,
            delivery_location=delivery_location,
            delivery_date=delivery_date,
            notes=notes,
            created_by=created_by,
        )
        for description, quantity, unit_price, product in items:
            OrderItem.objects.create(
                order=order,
                product=product,
                description=description,
                quantity=Decimal(str(quantity)),
                unit_price_cents=unit_price,
            )
        stamp(order, created_at=at, updated_at=at)
        return order

    def _make_payment(
        self,
        *,
        order,
        when,
        kind=PaymentKind.PAYMENT,
        role=PaymentRole.FINAL,
        method,
        amount,
        note="",
        created_by=None,
    ):
        payment = Payment.objects.create(
            order=order,
            customer=order.customer,
            kind=kind,
            role=role,
            method=method,
            amount_cents=amount,
            location=order.location,
            note=note,
            created_by=created_by,
        )
        stamp(payment, created_at=when)
        return payment

    def _pos_order(
        self,
        *,
        code,
        at,
        lines,
        method,
        customers,
        cashier,
        customer=None,
    ):
        customer = customer or customers["walkin"]
        total = sum(int(quantity * price) for _, quantity, price, _ in lines)
        order = self._make_order(
            code=code,
            at=at,
            order_type=OrderType.REGULAR,
            status=OrderStatus.FULFILLED,
            source=OrderSource.POS,
            customer=customer,
            items=lines,
            location="cafe",
            notes="Seeded demo sale.",
            created_by=cashier,
        )
        self._make_payment(
            order=order,
            when=at,
            method=method,
            amount=total,
            created_by=cashier,
        )
        for _, quantity, _, product in lines:
            finished = InventoryItem.objects.get(product=product, kind=ItemKind.FINISHED)
            self._move(
                finished,
                "cafe",
                -quantity,
                "sale",
                at,
                order.id,
                f"Sale {code}",
                actor=cashier,
            )
        return order

    def _create_pos_orders(self, products, customers, cashier):
        lines_1002 = [
            ("Mocha", 1, 500000, products["mocha"]),
            ("Chocolate Custard", 1, 480000, products["chocolate-custard"]),
        ]
        self._pos_order(
            code="POS-1002",
            at=days_ago(20, 13, 5),
            lines=lines_1002,
            method="transfer",
            customers=customers,
            cashier=cashier,
        )
        self._pos_order(
            code="POS-1003",
            at=days_ago(13, 15, 40),
            lines=[
                ("Mille-feuille", 1, 550000, products["mille-feuille"]),
                ("Cream Puffs", 3, 380000, products["cream-puffs"]),
            ],
            method="card",
            customers=customers,
            cashier=cashier,
            customer=customers["individual"],
        )
        self._pos_order(
            code="POS-1004",
            at=days_ago(9, 11, 15),
            lines=[
                ("Chocolate Custard", 2, 480000, products["chocolate-custard"]),
                ("Strawberry Tart", 2, 420000, products["strawberry-tart"]),
            ],
            method="cash",
            customers=customers,
            cashier=cashier,
            customer=customers["individual"],
        )
        self._pos_order(
            code="POS-1005",
            at=days_ago(5, 16, 10),
            lines=[("Cream Puffs", 6, 380000, products["cream-puffs"])],
            method="pos",
            customers=customers,
            cashier=cashier,
            customer=customers["brightline"],
        )
        self._pos_order(
            code="POS-1006",
            at=days_ago(2, 12, 30),
            lines=[
                ("Vanilla Custard", 1, 450000, products["vanilla-custard"]),
                ("Mocha", 2, 500000, products["mocha"]),
            ],
            method="cash",
            customers=customers,
            cashier=cashier,
        )
        self._pos_order(
            code="POS-1007",
            at=days_ago(0, 9, 20),
            lines=[
                ("Mocha", 2, 500000, products["mocha"]),
                ("Cream Puffs", 1, 380000, products["cream-puffs"]),
            ],
            method="pos",
            customers=customers,
            cashier=cashier,
        )

    def _create_management_orders(self, customers, manager):
        today = timezone.localdate()
        custom = self._make_order(
            code="ORD-2001",
            at=days_ago(10, 10, 0),
            order_type=OrderType.ORGANIZATIONAL,
            status=OrderStatus.IN_PRODUCTION,
            source=OrderSource.BMS,
            customer=customers["brightline"],
            items=[
                ("Three-tier botanical celebration cake", 1, 18000000, None),
                ("Cake box (large) — presentation packaging", 1, 0, None),
            ],
            location="home_bakery",
            delivery_location="home_bakery",
            delivery_date=today + timedelta(days=5),
            notes=(
                "Demo quotation. Deposit received; balance due on delivery. Customer requested "
                "botanical palette."
            ),
            created_by=manager,
        )
        self._make_payment(
            order=custom,
            when=days_ago(8, 10, 0),
            role=PaymentRole.DEPOSIT,
            method="transfer",
            amount=9000000,
            note="Deposit (demo)",
            created_by=manager,
        )

        bulk = self._make_order(
            code="ORD-2003",
            at=days_ago(6, 9, 0),
            order_type=OrderType.BULK,
            status=OrderStatus.CONFIRMED,
            source=OrderSource.BMS,
            customer=customers["brightline"],
            items=[("Cream Puffs — box of six", 20, 380000, None)],
            location="home_bakery",
            delivery_location="cafe",
            delivery_date=today + timedelta(days=3),
            notes="Demo bulk order for an office event.",
            created_by=manager,
        )
        self._make_payment(
            order=bulk,
            when=days_ago(5, 9, 0),
            role=PaymentRole.DEPOSIT,
            method="transfer",
            amount=3000000,
            note="Deposit (demo)",
            created_by=manager,
        )

        self._make_order(
            code="INQ-3001",
            at=days_ago(1, 16, 20),
            order_type=OrderType.CUSTOM,
            status=OrderStatus.INQUIRY,
            source=OrderSource.WEBSITE,
            customer=customers["website"],
            items=[("Anniversary cake for 40 guests", 1, 0, None)],
            location="home_bakery",
            delivery_date=today + timedelta(days=18),
            notes=(
                "Website inquiry (demo). Prefers vanilla and berries. Awaiting quotation."
            ),
        )

    # --------------------------------------------------------------- purchasing

    def _create_purchasing(self, items, actor):
        aurora, _ = Supplier.objects.update_or_create(
            name="Aurora Milling (demo)",
            defaults={"contact_name": "Orders desk", "notes": "Demo supplier record."},
        )
        green, _ = Supplier.objects.update_or_create(
            name="Green Valley Demo Supplies",
            defaults={
                "contact_name": "Trade counter",
                "notes": "Demo dairy and produce supplier.",
            },
        )
        stamp(aurora, created_at=days_ago(25))
        stamp(green, created_at=days_ago(24))

        po_5001 = PurchaseOrder.objects.create(
            code="PO-5001",
            supplier=aurora,
            status=PurchaseOrder.Status.ORDERED,
            expected_at=timezone.localdate() + timedelta(days=3),
            notes="Demo purchase order. Stock is only added when goods are received.",
            created_by=actor,
        )
        for item, quantity, cost in [
            (items["ing_flour"], 50, 115000),
            (items["ing_sugar"], 30, 145000),
        ]:
            PurchaseOrderLine.objects.create(
                purchase_order=po_5001,
                item=item,
                quantity=Decimal(quantity),
                unit_cost_cents=cost,
            )
        stamp(po_5001, created_at=days_ago(2))

        po_5002 = PurchaseOrder.objects.create(
            code="PO-5002",
            supplier=green,
            status=PurchaseOrder.Status.RECEIVED,
            notes="Demo purchase order, fully received.",
            created_by=actor,
        )
        receipt = PurchaseReceipt.objects.create(
            purchase_order=po_5002,
            supplier=green,
            location="home_bakery",
            received_by=actor,
            received_by_label=actor.name,
        )
        receipt_lines = [
            (items["ing_butter"], 20, 320000),
            (items["ing_cream"], 15, 450000),
        ]
        for item, quantity, cost in receipt_lines:
            PurchaseOrderLine.objects.create(
                purchase_order=po_5002,
                item=item,
                quantity=Decimal(quantity),
                unit_cost_cents=cost,
            )
            PurchaseReceiptLine.objects.create(
                receipt=receipt,
                item=item,
                quantity=Decimal(quantity),
                unit_cost_cents=cost,
            )
            self._move(
                item,
                "home_bakery",
                quantity,
                "purchase_receipt",
                days_ago(3, 9, 30),
                po_5002.id,
                "PO-5002 receipt",
                actor=actor,
                event_id=receipt.id,
            )
        stamp(po_5002, created_at=days_ago(5))
        stamp(receipt, received_at=days_ago(3, 9, 30))

        payment = SupplierPayment.objects.create(
            supplier=green,
            amount_cents=5000000,
            method="transfer",
            note="Part payment (demo)",
            created_by=actor,
        )
        stamp(payment, created_at=days_ago(2))
        return aurora, green

    # ---------------------------------------------------------------- transfers

    def _create_transfers(self, items, actor):
        completed = Transfer.objects.create(
            code="TRF-6001",
            from_location="home_bakery",
            to_location="cafe",
            status=TransferStatus.RECEIVED,
            notes="Demo completed transfer.",
            dispatched_at=days_ago(4, 8, 0),
            received_at=days_ago(4, 11, 0),
            created_by=actor,
        )
        TransferLine.objects.create(
            transfer=completed, item=items["fin_creampuff"], quantity=Decimal(6)
        )
        stamp(completed, created_at=days_ago(4, 7, 30))

        pending = Transfer.objects.create(
            code="TRF-6002",
            from_location="home_bakery",
            to_location="cafe",
            status=TransferStatus.REQUESTED,
            notes="Demo pending transfer request.",
            created_by=actor,
        )
        TransferLine.objects.create(
            transfer=pending, item=items["ing_strawberry"], quantity=Decimal(4)
        )
        stamp(pending, created_at=days_ago(0, 10, 0))

    # ------------------------------------------------------------------ recipes

    def _create_recipes(self, products, items):
        for slug, spec in RECIPES.items():
            recipe, _ = Recipe.objects.update_or_create(
                product=products[slug],
                defaults={
                    "yield_quantity": Decimal(str(spec["yield"])),
                    "notes": spec["notes"],
                },
            )
            RecipeLine.objects.filter(recipe=recipe).delete()
            for item_key, quantity in spec["lines"]:
                RecipeLine.objects.create(
                    recipe=recipe,
                    item=items[item_key],
                    quantity=Decimal(str(quantity)),
                )

    # ------------------------------------------------------------------ batches

    def _create_batches(self, products, production):
        custom = Order.objects.get(code="ORD-2001")
        batch_7002 = ProductionBatch.objects.create(
            code="BATCH-7002",
            title="Three-tier botanical celebration cake",
            order=custom,
            quantity=Decimal(1),
            location="home_bakery",
            status=BatchStatus.IN_PRODUCTION,
            assigned_employee=production,
            scheduled_for=timezone.now(),
            started_at=days_ago(0, 8, 0),
            notes=(
                "Custom cake for Brightline Demo Ltd. No recipe attached (custom "
                "specification)."
            ),
            created_by=production,
        )
        stamp(batch_7002, created_at=days_ago(3))

        recipe = Recipe.objects.get(product=products["vanilla-custard"])
        batch_7003 = ProductionBatch.objects.create(
            code="BATCH-7003",
            title="Vanilla Custard — batch",
            product=products["vanilla-custard"],
            recipe=recipe,
            quantity=Decimal(8),
            location="home_bakery",
            status=BatchStatus.SCHEDULED,
            assigned_employee=production,
            scheduled_for=timezone.now() + timedelta(days=1),
            created_by=production,
        )
        stamp(batch_7003, created_at=days_ago(0, 7, 30))

    # ----------------------------------------------------------------- expenses

    def _create_expenses(self, manager):
        rows = [
            (ExpenseCategory.UTILITIES, 7500000, "home_bakery", "Demo utilities expense", days_ago(10)),
            (ExpenseCategory.PACKAGING, 4200000, "cafe", "Demo packaging restock", days_ago(7)),
            (ExpenseCategory.MARKETING, 2500000, "cafe", "Demo seasonal print campaign", days_ago(3)),
        ]
        for category, amount, location, note, when in rows:
            expense = Expense.objects.create(
                category=category,
                amount_cents=amount,
                location=location,
                note=note,
                incurred_at=when.date(),
                recorded_by=manager,
                recorded_by_label=manager.name,
            )
            stamp(expense, created_at=when)
