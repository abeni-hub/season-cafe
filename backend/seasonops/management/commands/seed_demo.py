from decimal import Decimal
from django.core.management.base import BaseCommand
from seasonops.models import (
    CakeProduct,
    CatalogCategory,
    Ingredient,
    IngredientBalance,
    Location,
    ProductBalance,
    Recipe,
    RecipeIngredient,
    Supplier,
    User,
)


class Command(BaseCommand):
    help = "Seeds initial demo data for Seasons Cake BMS (locations, users, catalog, stock)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Seasons Cake demo data...")

        # 1. Locations
        bakery, _ = Location.objects.get_or_create(
            code="home-bakery",
            defaults={"name": "Seasons Cake - Home Bakery", "kind": Location.Kind.HOME_BAKERY, "is_active": True},
        )
        cafe, _ = Location.objects.get_or_create(
            code="bole-cafe",
            defaults={"name": "Seasons Cake - Bole Café", "kind": Location.Kind.CAFE, "is_active": True},
        )
        self.stdout.write(f"✓ Locations initialized: {bakery.name}, {cafe.name}")

        # 2. Staff Accounts
        owner, _ = User.objects.get_or_create(
            username="owner",
            defaults={
                "first_name": "Seasons",
                "last_name": "Admin",
                "email": "owner@seasonscake.com",
                "role": User.Role.OWNER,
                "workspace": User.Workspace.CAFE,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        owner.set_password("admin1234")
        owner.save()

        cashier, _ = User.objects.get_or_create(
            username="cashier",
            defaults={
                "first_name": "Almaz",
                "last_name": "Hailu",
                "email": "almaz@seasonscake.com",
                "role": User.Role.EMPLOYEE,
                "workspace": User.Workspace.CAFE,
                "location": cafe,
            },
        )
        cashier.set_password("cashier1234")
        cashier.location = cafe
        cashier.save()

        baker, _ = User.objects.get_or_create(
            username="baker",
            defaults={
                "first_name": "Dawit",
                "last_name": "Bekele",
                "email": "dawit@seasonscake.com",
                "role": User.Role.EMPLOYEE,
                "workspace": User.Workspace.BAKERY,
                "location": bakery,
            },
        )
        baker.set_password("baker1234")
        baker.location = bakery
        baker.save()

        manager, _ = User.objects.get_or_create(
            username="manager",
            defaults={
                "first_name": "Sara",
                "last_name": "Tadesse",
                "email": "sara@seasonscake.com",
                "role": User.Role.MANAGER,
                "workspace": User.Workspace.CAFE,
                "location": cafe,
            },
        )
        manager.set_password("manager1234")
        manager.location = cafe
        manager.save()

        self.stdout.write("✓ Staff accounts created: owner, cashier, baker, manager")

        # 3. Categories
        cat_sig, _ = CatalogCategory.objects.get_or_create(
            name="Signature Cakes",
            defaults={"kind": CatalogCategory.Kind.PRODUCT, "is_published": True},
        )
        cat_season, _ = CatalogCategory.objects.get_or_create(
            name="Seasonal Specialties",
            defaults={"kind": CatalogCategory.Kind.PRODUCT, "is_published": True},
        )
        cat_mini, _ = CatalogCategory.objects.get_or_create(
            name="Mini Cakes & Pastries",
            defaults={"kind": CatalogCategory.Kind.PRODUCT, "is_published": True},
        )
        cat_dry, _ = CatalogCategory.objects.get_or_create(
            name="Flour, Sugar & Dry Pantry",
            defaults={"kind": CatalogCategory.Kind.INGREDIENT},
        )
        cat_dairy, _ = CatalogCategory.objects.get_or_create(
            name="Dairy, Cold & Produce",
            defaults={"kind": CatalogCategory.Kind.INGREDIENT},
        )

        # 4. Suppliers
        flour_supplier, _ = Supplier.objects.get_or_create(
            name="Addis Millers & Grain",
            defaults={"phone": "+251911112233"},
        )
        dairy_supplier, _ = Supplier.objects.get_or_create(
            name="Highland Dairy & Butter",
            defaults={"phone": "+251922334455"},
        )

        # 5. Ingredients
        flour, _ = Ingredient.objects.get_or_create(
            name="Premium Cake Flour",
            defaults={"unit": "kg", "reorder_level": Decimal("10.000"), "category": cat_dry},
        )
        flour.suppliers.add(flour_supplier)

        sugar, _ = Ingredient.objects.get_or_create(
            name="Granulated Sugar",
            defaults={"unit": "kg", "reorder_level": Decimal("10.000"), "category": cat_dry},
        )
        butter, _ = Ingredient.objects.get_or_create(
            name="Unsalted Creamery Butter",
            defaults={"unit": "kg", "reorder_level": Decimal("5.000"), "category": cat_dairy},
        )
        butter.suppliers.add(dairy_supplier)

        cocoa, _ = Ingredient.objects.get_or_create(
            name="Dutch Process Cocoa Powder",
            defaults={"unit": "kg", "reorder_level": Decimal("3.000"), "category": cat_dry},
        )
        strawberries, _ = Ingredient.objects.get_or_create(
            name="Fresh Local Strawberries",
            defaults={"unit": "kg", "reorder_level": Decimal("2.000"), "category": cat_dairy},
        )
        eggs, _ = Ingredient.objects.get_or_create(
            name="Farm Fresh Eggs",
            defaults={"unit": "piece", "reorder_level": Decimal("60.000"), "category": cat_dairy},
        )

        # 6. Cake Products
        fudge_cake, _ = CakeProduct.objects.get_or_create(
            name="Chocolate Fudge Gateau",
            defaults={
                "category": cat_sig,
                "unit_price": Decimal("650.00"),
                "selling_unit": "cake",
                "web_id": "chocolate-fudge-gateau",
                "is_active": True,
                "is_published": True,
                "description": "Rich dark chocolate ganache layered with moist cocoa sponge.",
            },
        )
        strawberry_cake, _ = CakeProduct.objects.get_or_create(
            name="Strawberry Vanilla Dream",
            defaults={
                "category": cat_season,
                "unit_price": Decimal("750.00"),
                "selling_unit": "cake",
                "web_id": "strawberry-vanilla-dream",
                "is_active": True,
                "is_published": True,
                "description": "Fresh highland strawberries layered with real Madagascar vanilla bean cream.",
            },
        )
        red_velvet, _ = CakeProduct.objects.get_or_create(
            name="Red Velvet Romance",
            defaults={
                "category": cat_sig,
                "unit_price": Decimal("700.00"),
                "selling_unit": "cake",
                "web_id": "red-velvet-romance",
                "is_active": True,
                "is_published": True,
                "description": "Velvety crimson cake filled with silky cream cheese frosting.",
            },
        )
        mini_pastry, _ = CakeProduct.objects.get_or_create(
            name="Mini Berry Tartlet",
            defaults={
                "category": cat_mini,
                "unit_price": Decimal("150.00"),
                "selling_unit": "piece",
                "web_id": "mini-berry-tartlet",
                "is_active": True,
                "is_published": True,
                "description": "Buttery shortcrust shell filled with pastry cream and fresh berries.",
            },
        )

        # 7. Recipes
        fudge_recipe, _ = Recipe.objects.get_or_create(
            product=fudge_cake,
            version=1,
            defaults={"is_current": True, "created_by": owner},
        )
        RecipeIngredient.objects.get_or_create(recipe=fudge_recipe, ingredient=flour, defaults={"quantity": Decimal("0.350"), "unit": "kg"})
        RecipeIngredient.objects.get_or_create(recipe=fudge_recipe, ingredient=sugar, defaults={"quantity": Decimal("0.300"), "unit": "kg"})
        RecipeIngredient.objects.get_or_create(recipe=fudge_recipe, ingredient=butter, defaults={"quantity": Decimal("0.200"), "unit": "kg"})
        RecipeIngredient.objects.get_or_create(recipe=fudge_recipe, ingredient=cocoa, defaults={"quantity": Decimal("0.100"), "unit": "kg"})
        RecipeIngredient.objects.get_or_create(recipe=fudge_recipe, ingredient=eggs, defaults={"quantity": Decimal("4.000"), "unit": "piece"})

        # 8. Initial Inventory Stock
        # Bakery raw ingredients
        for ing, qty in [(flour, Decimal("50.000")), (sugar, Decimal("40.000")), (butter, Decimal("25.000")), (cocoa, Decimal("15.000")), (strawberries, Decimal("10.000")), (eggs, Decimal("180.000"))]:
            bal, _ = IngredientBalance.objects.get_or_create(location=bakery, ingredient=ing, defaults={"quantity": qty})
            bal.quantity = qty
            bal.save()

        # Café finished cakes on hand
        for prod, qty in [(fudge_cake, Decimal("8.000")), (strawberry_cake, Decimal("5.000")), (red_velvet, Decimal("6.000")), (mini_pastry, Decimal("20.000"))]:
            bal, _ = ProductBalance.objects.get_or_create(location=cafe, product=prod, defaults={"quantity": qty})
            bal.quantity = qty
            bal.save()

        # Bakery finished cakes on hand
        for prod, qty in [(fudge_cake, Decimal("4.000")), (strawberry_cake, Decimal("4.000"))]:
            bal, _ = ProductBalance.objects.get_or_create(location=bakery, product=prod, defaults={"quantity": qty})
            bal.quantity = qty
            bal.save()

        self.stdout.write(self.style.SUCCESS("✓ Successfully seeded Seasons Cake demo data!"))
        self.stdout.write("--------------------------------------------------")
        self.stdout.write("Default Demo Logins:")
        self.stdout.write("  Owner:    username 'owner'    | password 'admin1234'")
        self.stdout.write("  Cashier:  username 'cashier'  | password 'cashier1234'")
        self.stdout.write("  Baker:    username 'baker'    | password 'baker1234'")
        self.stdout.write("  Manager:  username 'manager'  | password 'manager1234'")
        self.stdout.write("--------------------------------------------------")
