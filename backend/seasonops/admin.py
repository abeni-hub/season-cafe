from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm
from django.db import transaction

from .models import (
    AuditEvent,
    BusinessSettings,
    CakeProduct,
    CatalogCategory,
    CustomerOrder,
    CustomerOrderLine,
    Ingredient,
    IngredientBalance,
    IngredientPurchase,
    IngredientPurchaseLine,
    IngredientSupplier,
    Location,
    Payment,
    ProductBalance,
    ProductionBatch,
    ProductionConsumption,
    Recipe,
    RecipeIngredient,
    Sale,
    SaleCancellation,
    SaleRefund,
    SaleRefundLine,
    SaleLine,
    StockMovement,
    StockTransfer,
    Supplier,
    User,
)


class ReadOnlyAdminMixin:
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


BUSINESS_PERMISSION_CHOICES = [
    ("dashboard", "View dashboard"),
    ("orders", "Manage customer orders"),
    ("sales", "Record sales and payments"),
    ("inventory", "View inventory"),
    ("inventory_adjust", "Adjust inventory"),
    ("production", "Record production"),
    ("purchases", "Record ingredient purchases"),
    ("purchases_approve", "Approve ingredient purchases"),
    ("transfers", "View and record stock transfers"),
    ("reports", "View financial and operational reports"),
    ("recipes", "View recipes"),
    ("recipes_manage", "Create recipe versions"),
    ("catalog", "Manage product and ingredient catalog"),
    ("website_content", "Manage public website content"),
    ("inquiries", "Manage customer inquiries"),
    ("users", "Manage staff accounts"),
    ("audit", "View audit history"),
]


class BusinessUserAdminForm(forms.ModelForm):
    use_role_defaults = forms.BooleanField(
        required=False,
        initial=True,
        label="Use role/workspace defaults",
    )
    business_permissions = forms.MultipleChoiceField(
        choices=BUSINESS_PERMISSION_CHOICES,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        help_text="Leave blank to use the role/workspace defaults.",
    )

    class Meta:
        model = User
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            permissions = self.instance.business_permissions
            if permissions is None:
                permissions = self.instance.effective_business_permissions
            self.initial["business_permissions"] = sorted(permissions)
            self.initial["use_role_defaults"] = self.instance.business_permissions is None


class BusinessUserCreationForm(UserCreationForm):
    workspace = forms.ChoiceField(choices=User.Workspace.choices)
    role = forms.ChoiceField(choices=User.Role.choices)
    location = forms.ModelChoiceField(queryset=Location.objects.all(), required=False)
    use_role_defaults = forms.BooleanField(
        required=False,
        initial=True,
        label="Use role/workspace defaults",
    )
    business_permissions = forms.MultipleChoiceField(
        choices=BUSINESS_PERMISSION_CHOICES,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        help_text="Leave blank to use the role/workspace defaults.",
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = (
            "username",
            "email",
            "role",
            "workspace",
            "location",
            "use_role_defaults",
            "business_permissions",
        )


@admin.register(User)
class BusinessUserAdmin(UserAdmin):
    form = BusinessUserAdminForm
    add_form = BusinessUserCreationForm
    list_display = ["username", "email", "role", "location", "is_active", "is_staff"]
    list_filter = ["role", "location", "is_active", "is_staff"]
    fieldsets = UserAdmin.fieldsets + (
        ("Business access", {"fields": ("role", "workspace", "location", "use_role_defaults", "business_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("username", "password1", "password2")}),
        ("Business access", {"fields": ("role", "workspace", "location", "use_role_defaults", "business_permissions")}),
    )

    def save_model(self, request, obj, form, change):
        selected_permissions = form.cleaned_data["business_permissions"]
        obj.business_permissions = None if form.cleaned_data["use_role_defaults"] else selected_permissions
        super().save_model(request, obj, form, change)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "kind", "is_active"]
    list_filter = ["kind", "is_active"]
    search_fields = ["name", "code"]


@admin.register(CatalogCategory)
class CatalogCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "is_active"]
    list_filter = ["kind", "is_active"]
    search_fields = ["name"]


@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    list_display = ["require_purchase_approval", "updated_at"]
    readonly_fields = ["updated_at"]

    def has_add_permission(self, request):
        return not BusinessSettings.objects.exists()

    def save_model(self, request, obj, form, change):
        obj.pk = 1
        super().save_model(request, obj, form, change)


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 0
    min_num = 1
    validate_min = True


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ["product", "version", "is_current", "created_by", "created_at"]
    inlines = [RecipeIngredientInline]
    readonly_fields = ["version", "created_by", "created_at", "updated_at"]

    def has_change_permission(self, request, obj=None):
        return obj is None and super().has_change_permission(request, obj)

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        if change:
            return
        obj.version = (Recipe.objects.filter(product=obj.product).order_by("-version").values_list("version", flat=True).first() or 0) + 1
        obj.is_current = True
        obj.created_by = request.user
        Recipe.objects.filter(product=obj.product, is_current=True).update(is_current=False)
        super().save_model(request, obj, form, change)


@admin.register(CakeProduct)
class CakeProductAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "selling_unit", "web_id", "sku", "unit_price", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["name", "web_id", "sku"]


class IngredientSupplierInline(admin.TabularInline):
    model = IngredientSupplier
    extra = 0


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "unit", "reorder_level", "is_active"]
    list_filter = ["category", "is_active", "unit"]
    search_fields = ["name"]
    inlines = [IngredientSupplierInline]


class ProductionConsumptionInline(admin.TabularInline):
    model = ProductionConsumption
    extra = 0
    can_delete = False
    readonly_fields = [field.name for field in ProductionConsumption._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(IngredientSupplier)
class IngredientSupplierAdmin(admin.ModelAdmin):
    list_display = ["ingredient", "supplier", "last_unit_cost", "updated_at"]
    list_filter = ["supplier"]
    search_fields = ["ingredient__name", "supplier__name"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "is_active"]
    search_fields = ["name", "phone"]


@admin.register(IngredientPurchase)
class IngredientPurchaseAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["id", "location", "supplier", "purchased_at", "status", "recorded_by", "approved_by"]
    list_filter = ["location", "status", "purchased_at"]
    readonly_fields = [field.name for field in IngredientPurchase._meta.fields]


@admin.register(IngredientPurchaseLine)
class IngredientPurchaseLineAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["purchase", "ingredient", "quantity", "unit_cost"]
    list_filter = ["ingredient"]
    readonly_fields = [field.name for field in IngredientPurchaseLine._meta.fields]


@admin.register(ProductionBatch)
class ProductionBatchAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["product", "quantity", "location", "produced_at", "recorded_by"]
    list_filter = ["location", "produced_at"]
    readonly_fields = [field.name for field in ProductionBatch._meta.fields]
    inlines = [ProductionConsumptionInline]


class CustomerOrderLineInline(admin.TabularInline):
    model = CustomerOrderLine
    extra = 0
    readonly_fields = [field.name for field in CustomerOrderLine._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustomerOrder)
class CustomerOrderAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["id", "customer_name", "customer_phone", "location", "source", "requested_for", "status"]
    list_filter = ["location", "source", "status", "requested_for"]
    search_fields = ["customer_name", "customer_phone", "customer_email"]
    readonly_fields = [field.name for field in CustomerOrder._meta.fields]
    inlines = [CustomerOrderLineInline]


class SaleLineInline(admin.TabularInline):
    model = SaleLine
    extra = 0
    readonly_fields = ["product", "quantity", "unit_price"]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = [field.name for field in Payment._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SaleRefundLineInline(admin.TabularInline):
    model = SaleRefundLine
    extra = 0
    readonly_fields = [field.name for field in SaleRefundLine._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SaleRefundInline(admin.TabularInline):
    model = SaleRefund
    extra = 0
    readonly_fields = [field.name for field in SaleRefund._meta.fields]

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ["id", "location", "cashier", "sold_at", "status"]
    list_filter = ["location", "status", "sold_at"]
    inlines = [SaleLineInline, PaymentInline, SaleRefundInline]
    readonly_fields = ["location", "cashier", "sold_at", "created_at", "note", "status", "idempotency_key"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SaleRefund)
class SaleRefundAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["created_at", "sale", "method", "amount", "bank_name", "refunded_by"]
    list_filter = ["method", "bank_name", "refund_date"]
    readonly_fields = [field.name for field in SaleRefund._meta.fields]
    inlines = [SaleRefundLineInline]


@admin.register(SaleCancellation)
class SaleCancellationAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["cancelled_at", "sale", "cancelled_by", "reason"]
    list_filter = ["cancelled_at"]
    readonly_fields = [field.name for field in SaleCancellation._meta.fields]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ["created_at", "location", "kind", "ingredient", "product", "quantity_delta", "actor"]
    list_filter = ["location", "kind", "created_at"]
    readonly_fields = [field.name for field in StockMovement._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AuditEvent)
class AuditEventAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ["created_at", "location", "actor", "action", "summary"]
    list_filter = ["location", "action", "created_at"]
    search_fields = ["summary", "target_type", "target_id", "actor__username"]
    readonly_fields = [field.name for field in AuditEvent._meta.fields]


@admin.register(IngredientBalance)
class IngredientBalanceAdmin(admin.ModelAdmin):
    list_display = ["location", "ingredient", "quantity"]
    list_filter = ["location"]
    readonly_fields = ["location", "ingredient", "quantity"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProductBalance)
class ProductBalanceAdmin(admin.ModelAdmin):
    list_display = ["location", "product", "quantity"]
    list_filter = ["location"]
    readonly_fields = ["location", "product", "quantity"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = ["created_at", "source_location", "destination_location", "ingredient", "product", "quantity", "status"]
    list_filter = ["source_location", "destination_location", "status", "created_at"]
    readonly_fields = [field.name for field in StockTransfer._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
