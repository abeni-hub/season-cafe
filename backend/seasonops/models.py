from decimal import Decimal

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class Location(models.Model):
    class Kind(models.TextChoices):
        HOME_BAKERY = "home_bakery", "Home bakery"
        CAFE = "cafe", "Café / sales"
        OTHER = "other", "Other"

    name = models.CharField(max_length=120, unique=True)
    code = models.SlugField(max_length=32, unique=True)
    kind = models.CharField(max_length=24, choices=Kind.choices, default=Kind.OTHER)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CatalogCategory(models.Model):
    class Kind(models.TextChoices):
        PRODUCT = "product", "Cake product"
        INGREDIENT = "ingredient", "Ingredient"

    kind = models.CharField(max_length=16, choices=Kind.choices)
    name = models.CharField(max_length=80)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ["kind", "name"]
        constraints = [
            models.UniqueConstraint(fields=["kind", "name"], name="unique_catalog_category"),
        ]

    def __str__(self):
        return self.name


class BusinessSettings(models.Model):
    require_purchase_approval = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

    def __str__(self):
        return "Business settings"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, username, email, password, **extra_fields):
        if not username:
            raise ValueError("A username is required.")
        user = self.model(username=username, email=self.normalize_email(email or ""), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.EMPLOYEE)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.OWNER)
        extra_fields.setdefault("location", None)
        if extra_fields.get("is_staff") is not True or extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_staff and is_superuser enabled.")
        return self._create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MANAGER = "manager", "Manager"
        EMPLOYEE = "employee", "Employee"

    class Workspace(models.TextChoices):
        BAKERY = "bakery", "Home bakery / production"
        CAFE = "cafe", "Café / sales"

    email = models.EmailField(blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.EMPLOYEE)
    workspace = models.CharField(
        max_length=16,
        choices=Workspace.choices,
        default=Workspace.CAFE,
    )
    business_permissions = models.JSONField(null=True, blank=True, default=None)
    location = models.ForeignKey(
        Location,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="users",
    )

    objects = UserManager()

    @property
    def effective_business_permissions(self):
        if self.is_superuser or self.role == self.Role.OWNER:
            return {
                "dashboard",
                "orders",
                "sales",
                "inventory",
                "inventory_adjust",
                "production",
                "purchases",
                "purchases_approve",
                "transfers",
                "reports",
                "recipes",
                "recipes_manage",
                "catalog",
                "website_content",
                "inquiries",
                "users",
                "audit",
            }
        if self.business_permissions is not None:
            return set(self.business_permissions)
        if self.role == self.Role.MANAGER:
            return {
                "dashboard",
                "orders",
                "sales",
                "inventory",
                "inventory_adjust",
                "production",
                "purchases",
                "transfers",
                "reports",
                "recipes",
            }
        if self.workspace == self.Workspace.BAKERY:
            return {"dashboard", "inventory", "production", "purchases", "transfers", "recipes"}
        return {"dashboard", "inventory", "orders", "sales", "transfers"}

    def clean(self):
        super().clean()
        if self.role == self.Role.OWNER and self.location_id:
            raise ValidationError({"location": "Owners have access to all locations."})
        if self.role != self.Role.OWNER and not self.location_id:
            raise ValidationError({"location": "Managers and employees must be assigned a location."})

    def __str__(self):
        return self.get_full_name() or self.username


class CakeProduct(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="products/", blank=True)
    image_alt = models.CharField(max_length=240, blank=True)
    category = models.ForeignKey(
        CatalogCategory,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="products",
        limit_choices_to={"kind": CatalogCategory.Kind.PRODUCT},
    )
    selling_unit = models.CharField(max_length=24, default="cake")
    web_id = models.SlugField(max_length=80, unique=True, null=True, blank=True)
    sku = models.CharField(max_length=40, unique=True, null=True, blank=True)
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    is_active = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    public_sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["name"]

    def clean(self):
        super().clean()
        if self.category_id and self.category.kind != CatalogCategory.Kind.PRODUCT:
            raise ValidationError({"category": "Choose a cake-product category."})

    def __str__(self):
        return self.name


class Ingredient(models.Model):
    class Unit(models.TextChoices):
        KILOGRAM = "kg", "Kilogram"
        GRAM = "g", "Gram"
        LITRE = "l", "Litre"
        MILLILITRE = "ml", "Millilitre"
        PIECE = "piece", "Piece"

    name = models.CharField(max_length=120, unique=True)
    category = models.ForeignKey(
        CatalogCategory,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="ingredients",
        limit_choices_to={"kind": CatalogCategory.Kind.INGREDIENT},
    )
    unit = models.CharField(max_length=24, choices=Unit.choices)
    reorder_level = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["name"]

    def clean(self):
        super().clean()
        if self.category_id and self.category.kind != CatalogCategory.Kind.INGREDIENT:
            raise ValidationError({"category": "Choose an ingredient category."})

    def __str__(self):
        return f"{self.name} ({self.unit})"


class Recipe(models.Model):
    product = models.ForeignKey(CakeProduct, on_delete=models.PROTECT, related_name="recipes")
    name = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    is_current = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="authored_recipes",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__name", "-version"]
        constraints = [
            models.UniqueConstraint(fields=["product", "version"], name="unique_recipe_version"),
            models.UniqueConstraint(
                fields=["product"],
                condition=Q(is_current=True),
                name="one_current_recipe_per_product",
            ),
        ]

    def __str__(self):
        return f"Recipe: {self.product.name} (v{self.version})"


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="ingredients")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    unit = models.CharField(max_length=24, choices=Ingredient.Unit.choices, default=Ingredient.Unit.GRAM)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["recipe", "ingredient"], name="unique_recipe_ingredient"),
        ]

    def __str__(self):
        return f"{self.quantity} {self.unit} {self.ingredient.name}"


class Supplier(models.Model):
    name = models.CharField(max_length=160, unique=True)
    phone = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    ingredients = models.ManyToManyField(Ingredient, through="IngredientSupplier", related_name="suppliers")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class IngredientSupplier(models.Model):
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="supplier_links")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="ingredient_links")
    last_unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["ingredient", "supplier"], name="unique_ingredient_supplier"),
        ]


class IngredientBalance(models.Model):
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="ingredient_balances")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="balances")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["location", "ingredient"], name="unique_ingredient_balance"),
            models.CheckConstraint(condition=Q(quantity__gte=0), name="ingredient_balance_nonnegative"),
        ]


class ProductBalance(models.Model):
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="product_balances")
    product = models.ForeignKey(CakeProduct, on_delete=models.PROTECT, related_name="balances")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["location", "product"], name="unique_product_balance"),
            models.CheckConstraint(condition=Q(quantity__gte=0), name="product_balance_nonnegative"),
        ]


class StockMovement(models.Model):
    class Kind(models.TextChoices):
        PURCHASE = "purchase", "Purchase"
        PRODUCTION_USE = "production_use", "Production use"
        PRODUCTION_OUTPUT = "production_output", "Production output"
        SALE = "sale", "Sale"
        SALE_RETURN = "sale_return", "Sale return"
        SALE_REVERSAL = "sale_reversal", "Sale cancellation reversal"
        ADJUSTMENT = "adjustment", "Adjustment"
        TRANSFER_IN = "transfer_in", "Transfer in"
        TRANSFER_OUT = "transfer_out", "Transfer out"
        TRANSFER_LOSS = "transfer_loss", "Transfer discrepancy"

    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="stock_movements")
    ingredient = models.ForeignKey(
        Ingredient,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    product = models.ForeignKey(
        CakeProduct,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    quantity_delta = models.DecimalField(max_digits=14, decimal_places=3)
    kind = models.CharField(max_length=24, choices=Kind.choices)
    reference = models.CharField(max_length=80, blank=True)
    note = models.CharField(max_length=240, blank=True)
    actor = models.ForeignKey(User, null=True, on_delete=models.PROTECT, related_name="stock_movements")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(ingredient__isnull=False, product__isnull=True)
                    | Q(ingredient__isnull=True, product__isnull=False)
                ),
                name="stock_movement_one_item_type",
            ),
            models.CheckConstraint(
                condition=~Q(quantity_delta=0),
                name="stock_movement_nonzero_quantity",
            ),
        ]


class AuditEvent(models.Model):
    location = models.ForeignKey(
        Location,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="business_audit_events",
    )
    action = models.CharField(max_length=48)
    summary = models.CharField(max_length=240)
    target_type = models.CharField(max_length=48)
    target_id = models.CharField(max_length=40)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["location", "-created_at"], name="audit_location_created_idx"),
            models.Index(fields=["actor", "-created_at"], name="audit_actor_created_idx"),
        ]


class IngredientPurchase(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="purchases")
    supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.PROTECT)
    purchased_at = models.DateTimeField(default=timezone.now)
    reference = models.CharField(max_length=80, blank=True)
    note = models.CharField(max_length=240, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.APPROVED)
    approved_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_purchases",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=240, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="purchases")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-purchased_at", "-id"]

    @property
    def total_cost(self):
        return sum((line.total_cost for line in self.lines.all()), Decimal("0.00"))


class IngredientPurchaseLine(models.Model):
    purchase = models.ForeignKey(IngredientPurchase, on_delete=models.PROTECT, related_name="lines")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    unit = models.CharField(max_length=24, choices=Ingredient.Unit.choices, default=Ingredient.Unit.GRAM)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    stock_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))

    @property
    def total_cost(self):
        return self.quantity * self.unit_cost


class ProductionBatch(models.Model):
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="production_batches")
    product = models.ForeignKey(CakeProduct, on_delete=models.PROTECT, related_name="production_batches")
    recipe = models.ForeignKey(Recipe, null=True, blank=True, on_delete=models.PROTECT, related_name="production_batches")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    produced_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=240, blank=True)
    adjustment_note = models.CharField(max_length=240, blank=True)
    wastage_quantity = models.PositiveIntegerField(default=0)
    wastage_note = models.CharField(max_length=240, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="production_batches")
    estimated_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, default=None)
    actual_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, default=None)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-produced_at", "-id"]

    @property
    def finished_quantity(self):
        return self.quantity - self.wastage_quantity


class ProductionConsumption(models.Model):
    batch = models.ForeignKey(ProductionBatch, on_delete=models.PROTECT, related_name="consumptions")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit = models.CharField(max_length=24, choices=Ingredient.Unit.choices)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True, default=None)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, default=None)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["batch", "ingredient"], name="unique_batch_consumption"),
        ]


class Customer(models.Model):
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40)
    normalized_phone = models.CharField(max_length=40, unique=True)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.name} ({self.phone})"


class CustomerOrder(models.Model):
    class Source(models.TextChoices):
        STAFF = "staff", "Staff"
        WEBSITE = "website", "Website"
        PHONE = "phone", "Phone"
        SOCIAL = "social", "Social media"
        OTHER = "other", "Other channel"

    class Fulfillment(models.TextChoices):
        PICKUP = "pickup", "Pickup"
        DELIVERY = "delivery", "Delivery"

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONFIRMED = "confirmed", "Confirmed"
        IN_PRODUCTION = "in_production", "In production"
        READY = "ready", "Ready"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    location = models.ForeignKey(
        Location,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="customer_orders",
    )
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    customer_name = models.CharField(max_length=160)
    customer_phone = models.CharField(max_length=40)
    customer_email = models.EmailField(blank=True)
    fulfillment = models.CharField(
        max_length=12,
        choices=Fulfillment.choices,
        default=Fulfillment.PICKUP,
    )
    delivery_address = models.TextField(blank=True)
    order_number = models.CharField(max_length=32, unique=True, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True)
    requested_for = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.STAFF)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="customer_orders",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["requested_for", "-created_at"]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.order_number:
            year = timezone.localtime(self.created_at).year
            self.order_number = f"SC-{year}-{self.pk:06d}"
            super().save(update_fields=["order_number"])

    @property
    def total(self):
        return sum((line.total for line in self.lines.all()), Decimal("0.00"))

    @property
    def direct_payments_total(self):
        return self.payments.aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")

    @property
    def amount_paid(self):
        if hasattr(self, "sale") and self.sale:
            sale_paid = sum((payment.amount for payment in self.sale.payments.all()), Decimal("0.00"))
            sale_refunded = sum((refund.amount for refund in self.sale.refunds.all()), Decimal("0.00"))
            net_sale = sale_paid - sale_refunded
            unlinked = self.payments.filter(sale__isnull=True).aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")
            return max(net_sale + unlinked, Decimal("0.00"))
        return self.direct_payments_total

    @property
    def amount_due(self):
        if self.status == self.Status.CANCELLED:
            return Decimal("0.00")
        return max(self.total - self.amount_paid, Decimal("0.00"))

    @property
    def payment_status(self):
        if self.status == self.Status.CANCELLED:
            return "cancelled"
        paid = self.amount_paid
        total = self.total
        if paid <= Decimal("0.00"):
            return "unpaid"
        if total > Decimal("0.00") and paid >= total:
            return "paid"
        return "partial"


class CustomerOrderLine(models.Model):
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(CakeProduct, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    size = models.CharField(max_length=40, blank=True)
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )

    @property
    def total(self):
        price = self.unit_price if self.unit_price is not None else (self.product.unit_price or Decimal("0.00"))
        return price * self.quantity


class CustomerOrderStatusHistory(models.Model):
    order = models.ForeignKey(CustomerOrder, on_delete=models.PROTECT, related_name="status_history")
    previous_status = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=CustomerOrder.Status.choices)
    note = models.CharField(max_length=240, blank=True)
    changed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="order_status_changes",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["created_at", "id"]


class Sale(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    order = models.OneToOneField(
        CustomerOrder,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="sale",
    )
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="sales")
    cashier = models.ForeignKey(User, on_delete=models.PROTECT, related_name="sales")
    sold_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    note = models.CharField(max_length=240, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-sold_at", "-id"]
        indexes = [
            models.Index(fields=["location", "sold_at"], name="sale_location_sold_idx"),
            models.Index(fields=["status", "sold_at"], name="sale_status_sold_idx"),
        ]

    @property
    def total(self):
        return sum((line.total for line in self.lines.all()), Decimal("0.00"))


class SaleLine(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="lines")
    product = models.ForeignKey(CakeProduct, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])

    @property
    def total(self):
        return self.unit_price * self.quantity


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        TELEBIRR = "telebirr", "Telebirr"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"

    sale = models.ForeignKey(
        Sale,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    order = models.ForeignKey(
        CustomerOrder,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    method = models.CharField(max_length=20, choices=Method.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    bank_name = models.CharField(max_length=80, blank=True)
    payment_date = models.DateField(default=timezone.localdate, db_index=True)
    reference = models.CharField(max_length=100, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True)
    received_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="payments_received")
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(sale__isnull=False) | Q(order__isnull=False),
                name="payment_linked_to_sale_or_order",
            ),
        ]


class SaleCancellation(models.Model):
    sale = models.OneToOneField(Sale, on_delete=models.PROTECT, related_name="cancellation")
    reason = models.CharField(max_length=240)
    idempotency_key = models.CharField(max_length=80, unique=True)
    request_fingerprint = models.CharField(max_length=64)
    cancelled_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="sale_cancellations")
    cancelled_at = models.DateTimeField(default=timezone.now)


class SaleRefund(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="refunds")
    original_payment = models.ForeignKey(
        Payment,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="refunds",
    )
    method = models.CharField(max_length=20, choices=Payment.Method.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    bank_name = models.CharField(max_length=80, blank=True)
    refund_date = models.DateField(default=timezone.localdate, db_index=True)
    reason = models.CharField(max_length=240)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True)
    refunded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="sale_refunds")
    created_at = models.DateTimeField(default=timezone.now, editable=False)


class SaleRefundLine(models.Model):
    refund = models.ForeignKey(SaleRefund, on_delete=models.PROTECT, related_name="lines")
    product = models.ForeignKey(CakeProduct, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["refund", "product"], name="unique_sale_refund_product"),
        ]


class TransferShipment(models.Model):
    source_location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="transfer_shipments_out")
    destination_location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="transfer_shipments_in")
    reference = models.CharField(max_length=80, blank=True)
    note = models.CharField(max_length=240, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True)
    request_fingerprint = models.CharField(max_length=64)
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="transfer_shipments")
    created_at = models.DateTimeField(default=timezone.now, editable=False)


class StockTransfer(models.Model):
    class Status(models.TextChoices):
        IN_TRANSIT = "in_transit", "In transit"
        PARTIALLY_RECEIVED = "partially_received", "Partially received"
        RECEIVED = "received", "Received"

    shipment = models.ForeignKey(
        TransferShipment,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="items",
    )
    source_location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="transfers_out")
    destination_location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="transfers_in")
    ingredient = models.ForeignKey(Ingredient, null=True, blank=True, on_delete=models.PROTECT)
    product = models.ForeignKey(CakeProduct, null=True, blank=True, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    received_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    legacy_source_deducted = models.BooleanField(default=False)
    reference = models.CharField(max_length=80, blank=True)
    note = models.CharField(max_length=240, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.IN_TRANSIT)
    received_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="received_stock_transfers",
    )
    received_at = models.DateTimeField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="stock_transfers")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(ingredient__isnull=False, product__isnull=True)
                    | Q(ingredient__isnull=True, product__isnull=False)
                ),
                name="stock_transfer_one_item_type",
            ),
            models.CheckConstraint(
                condition=~Q(source_location=F("destination_location")),
                name="stock_transfer_different_locations",
            ),
            models.CheckConstraint(
                condition=Q(received_quantity__gte=0) & Q(received_quantity__lte=F("quantity")),
                name="stock_transfer_received_within_quantity",
            ),
        ]

    @property
    def remaining_quantity(self):
        return self.quantity - self.received_quantity


class StockTransferReceipt(models.Model):
    transfer = models.ForeignKey(StockTransfer, on_delete=models.PROTECT, related_name="receipts")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal("0"))])
    is_final = models.BooleanField(default=True)
    discrepancy_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    discrepancy_note = models.CharField(max_length=240, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True)
    received_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="stock_transfer_receipts")
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["received_at", "id"]
