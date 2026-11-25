from datetime import datetime, time
from decimal import Decimal

from django.db import transaction
from django.db.models import Max, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    AuditEvent,
    BusinessSettings,
    CakeProduct,
    CatalogCategory,
    CustomerOrder,
    CustomerOrderLine,
    CustomerOrderStatusHistory,
    Ingredient,
    IngredientBalance,
    IngredientPurchase,
    IngredientPurchaseLine,
    Location,
    Payment,
    ProductBalance,
    ProductionBatch,
    ProductionConsumption,
    Recipe,
    RecipeIngredient,
    Sale,
    SaleLine,
    SaleRefund,
    SaleRefundLine,
    StockMovement,
    StockTransfer,
    StockTransferReceipt,
    Supplier,
    User,
)
from .services import (
    cancel_sale,
    create_order,
    create_sale,
    collect_sale_payment,
    produce_cakes,
    receive_purchase,
    record_stock,
    refund_sale,
    transfer_stock,
    log_activity,
)
from .units import convert_quantity
from .units import unit_cost_in_stock_unit


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ["id", "name", "code", "kind", "is_active"]



class PurchaseRejectionSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=240, allow_blank=False, trim_whitespace=True)

    def validate_reason(self, value):
        if not value:
            raise serializers.ValidationError("Enter a reason for rejecting this purchase.")
        return value


class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSettings
        fields = ["require_purchase_approval", "updated_at"]
        read_only_fields = ["updated_at"]



class PublicOrderResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    id = serializers.IntegerField()
    orderNumber = serializers.CharField()


class CakeProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    category = serializers.PrimaryKeyRelatedField(
        queryset=CatalogCategory.objects.filter(kind=CatalogCategory.Kind.PRODUCT, is_active=True),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = CakeProduct
        fields = [
            "id",
            "name",
            "description",
            "image",
            "image_alt",
            "category",
            "category_name",
            "web_id",
            "sku",
            "selling_unit",
            "unit_price",
            "is_active",
            "is_published",
            "is_featured",
            "public_sort_order",
        ]

    def validate_image(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Choose an image smaller than 5 MB.")
        return value

    def validate(self, attrs):
        is_published = attrs.get("is_published", getattr(self.instance, "is_published", False))
        category = attrs.get("category", getattr(self.instance, "category", None))
        web_id = attrs.get("web_id", getattr(self.instance, "web_id", None))
        unit_price = attrs.get("unit_price", getattr(self.instance, "unit_price", None))
        if is_published:
            errors = {}
            if not web_id:
                errors["web_id"] = "Assign a public cake ID before publishing this product."
            if unit_price is None:
                errors["unit_price"] = "Set a price before publishing this product."
            if category and (not category.is_active or not category.is_published):
                errors["category"] = "Activate and publish the product category before publishing this product."
            if not attrs.get("is_active", getattr(self.instance, "is_active", True)):
                errors["is_active"] = "Activate the product before publishing it."
            if errors:
                raise serializers.ValidationError(errors)
        return attrs


class CatalogCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogCategory
        fields = ["id", "kind", "name", "sort_order", "is_active", "is_published"]

    def validate(self, attrs):
        if self.instance and attrs.get("kind", self.instance.kind) != self.instance.kind:
            if self.instance.products.exists() or self.instance.ingredients.exists():
                raise serializers.ValidationError(
                    {"kind": "A category used by products or ingredients cannot change type."},
                )
        is_published = attrs.get("is_published", getattr(self.instance, "is_published", False))
        if is_published and not attrs.get("is_active", getattr(self.instance, "is_active", True)):
            raise serializers.ValidationError({"is_published": "Activate the category before publishing it."})
        return attrs


class IngredientSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    supplier_names = serializers.SerializerMethodField()
    category = serializers.PrimaryKeyRelatedField(
        queryset=CatalogCategory.objects.filter(kind=CatalogCategory.Kind.INGREDIENT, is_active=True),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Ingredient
        fields = ["id", "name", "category", "category_name", "unit", "reorder_level", "supplier_names", "is_active"]

    def validate_unit(self, value):
        ingredient = self.instance
        if ingredient and value != ingredient.unit and (
            IngredientBalance.objects.filter(ingredient=ingredient).exists()
            or RecipeIngredient.objects.filter(ingredient=ingredient).exists()
            or IngredientPurchaseLine.objects.filter(ingredient=ingredient).exists()
        ):
            raise serializers.ValidationError(
                "The stock unit cannot be changed after the ingredient is used in stock, purchases, or recipes.",
            )
        return value

    def get_supplier_names(self, ingredient) -> list[str]:
        return [supplier.name for supplier in ingredient.suppliers.filter(is_active=True)]


class RecipeIngredientReadSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    unit = serializers.CharField(source="ingredient.unit", read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ["id", "ingredient", "ingredient_name", "unit", "quantity"]


class RecipeIngredientInputSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(queryset=Ingredient.objects.filter(is_active=True))
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    unit = serializers.ChoiceField(choices=Ingredient.Unit.choices)

    def validate(self, attrs):
        convert_quantity(Decimal("1"), attrs["unit"], attrs["ingredient"].unit)
        return attrs


class RecipeSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product = serializers.PrimaryKeyRelatedField(queryset=CakeProduct.objects.filter(is_active=True))
    ingredients = RecipeIngredientInputSerializer(many=True, allow_empty=False)
    estimated_cost = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            "id",
            "product",
            "product_name",
            "name",
            "description",
            "version",
            "is_current",
            "created_at",
            "estimated_cost",
            "ingredients",
        ]
        read_only_fields = ["version", "is_current", "created_at"]
        validators = []

    def get_estimated_cost(self, recipe) -> Decimal | None:
        estimated = Decimal("0")
        for line in recipe.ingredients.select_related("ingredient"):
            latest = IngredientPurchaseLine.objects.filter(
                ingredient=line.ingredient,
                purchase__status=IngredientPurchase.Status.APPROVED,
            ).order_by("-purchase__purchased_at", "-pk").first()
            if latest:
                quantity = convert_quantity(line.quantity, line.unit, line.ingredient.unit)
                estimated += quantity * unit_cost_in_stock_unit(
                    latest.total_cost,
                    latest.stock_quantity,
                )
            else:
                return None
        return estimated.quantize(Decimal("0.01"))

    @transaction.atomic
    def create(self, validated_data):
        product = validated_data["product"]
        lines = validated_data.pop("ingredients")
        if any(line["ingredient"].pk == prior["ingredient"].pk for index, line in enumerate(lines) for prior in lines[:index]):
            raise serializers.ValidationError({"ingredients": "Each ingredient can appear only once."})
        Recipe.objects.filter(product=product, is_current=True).update(is_current=False)
        version = (Recipe.objects.filter(product=product).aggregate(max_version=Max("version"))["max_version"] or 0) + 1
        recipe = Recipe.objects.create(
            product=product,
            name=validated_data.get("name", "").strip(),
            description=validated_data.get("description", "").strip(),
            version=version,
            is_current=True,
            created_by=self.context["request"].user,
        )
        RecipeIngredient.objects.bulk_create(
            [RecipeIngredient(recipe=recipe, **line) for line in lines],
        )
        return recipe


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "notes", "is_active"]


class IngredientBalanceSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    unit = serializers.CharField(source="ingredient.unit", read_only=True)
    category_name = serializers.CharField(source="ingredient.category.name", read_only=True, default="")
    supplier_names = serializers.SerializerMethodField()
    reserved_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True, default=Decimal("0"))
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = IngredientBalance
        fields = [
            "id",
            "location",
            "ingredient",
            "ingredient_name",
            "unit",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "category_name",
            "supplier_names",
        ]

    def get_supplier_names(self, balance) -> list[str]:
        return [supplier.name for supplier in balance.ingredient.suppliers.filter(is_active=True)]

    def get_available_quantity(self, balance) -> Decimal:
        return max(balance.quantity - getattr(balance, "reserved_quantity", Decimal("0")), Decimal("0"))


class ProductBalanceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    reserved_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True, default=Decimal("0"))
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = ProductBalance
        fields = ["id", "location", "product", "product_name", "quantity", "reserved_quantity", "available_quantity"]

    def get_available_quantity(self, balance) -> Decimal:
        return max(balance.quantity - getattr(balance, "reserved_quantity", Decimal("0")), Decimal("0"))


class StockMovementSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "location",
            "ingredient",
            "product",
            "item_name",
            "unit",
            "quantity_delta",
            "kind",
            "reference",
            "note",
            "actor_name",
            "created_at",
        ]

    def get_item_name(self, movement) -> str:
        item = movement.ingredient or movement.product
        return item.name if item else ""

    def get_unit(self, movement) -> str:
        return movement.ingredient.unit if movement.ingredient_id else movement.product.selling_unit

    def get_actor_name(self, movement) -> str:
        return movement.actor.get_full_name() or movement.actor.username if movement.actor else "System"


class PurchaseLineSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    stock_unit = serializers.CharField(source="ingredient.unit", read_only=True)
    total_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = IngredientPurchaseLine
        fields = ["id", "ingredient", "ingredient_name", "quantity", "unit", "stock_quantity", "stock_unit", "unit_cost", "total_cost"]


class PurchaseInputLineSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(queryset=Ingredient.objects.filter(is_active=True))
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    unit = serializers.ChoiceField(choices=Ingredient.Unit.choices)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))

    def validate(self, attrs):
        convert_quantity(attrs["quantity"], attrs["unit"], attrs["ingredient"].unit)
        return attrs


class IngredientPurchaseSerializer(serializers.ModelSerializer):
    idempotency_key = serializers.CharField(max_length=80, write_only=True)
    lines = PurchaseInputLineSerializer(many=True, write_only=True, allow_empty=False)
    received_lines = PurchaseLineSerializer(source="lines", many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    recorded_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = IngredientPurchase
        fields = [
            "id",
            "location",
            "supplier",
            "supplier_name",
            "purchased_at",
            "reference",
            "note",
            "status",
            "rejection_reason",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "idempotency_key",
            "total_cost",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "lines",
            "received_lines",
        ]
        read_only_fields = ["location", "recorded_by", "created_at", "status", "rejection_reason", "approved_by", "approved_at"]

    def get_total_cost(self, purchase) -> Decimal:
        return purchase.total_cost.quantize(Decimal("0.01"))

    def get_recorded_by_name(self, purchase) -> str:
        return purchase.recorded_by.get_full_name() or purchase.recorded_by.username

    def get_approved_by_name(self, purchase) -> str:
        if not purchase.approved_by_id:
            return ""
        return purchase.approved_by.get_full_name() or purchase.approved_by.username

    def validate_lines(self, lines):
        ingredient_ids = [line["ingredient"].pk for line in lines]
        if len(ingredient_ids) != len(set(ingredient_ids)):
            raise serializers.ValidationError("Each ingredient can appear only once.")
        return lines

    def create(self, validated_data):
        lines = validated_data.pop("lines")
        return receive_purchase(
            location=self.context["location"],
            actor=self.context["request"].user,
            lines=lines,
            **validated_data,
        )


class ProductionConsumptionSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)

    class Meta:
        model = ProductionConsumption
        fields = ["ingredient", "ingredient_name", "quantity", "unit", "unit_cost", "total_cost"]


class ProductionBatchSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.username", read_only=True)
    recipe_version = serializers.IntegerField(source="recipe.version", read_only=True, allow_null=True)
    consumptions = serializers.SerializerMethodField()
    actual_consumption = RecipeIngredientInputSerializer(many=True, write_only=True, required=False)
    finished_quantity = serializers.IntegerField(read_only=True)
    idempotency_key = serializers.CharField(max_length=80, write_only=True)

    class Meta:
        model = ProductionBatch
        fields = [
            "id",
            "location",
            "product",
            "product_name",
            "recipe_version",
            "quantity",
            "finished_quantity",
            "produced_at",
            "note",
            "adjustment_note",
            "wastage_quantity",
            "wastage_note",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "estimated_cost",
            "actual_cost",
            "actual_consumption",
            "idempotency_key",
            "consumptions",
        ]
        read_only_fields = [
            "location",
            "recorded_by",
            "created_at",
            "recipe_version",
            "estimated_cost",
            "actual_cost",
            "finished_quantity",
        ]

    @extend_schema_field(ProductionConsumptionSerializer(many=True))
    def get_consumptions(self, batch):
        return ProductionConsumptionSerializer(batch.consumptions.select_related("ingredient"), many=True).data

    def create(self, validated_data):
        actual_consumption = validated_data.pop("actual_consumption", None)
        return produce_cakes(
            location=self.context["location"],
            actor=self.context["request"].user,
            actual_consumption=actual_consumption,
            **validated_data,
        )


class OrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CustomerOrderLine
        fields = ["id", "product", "product_name", "quantity", "size", "unit_price", "total"]


class OrderInputLineSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=CakeProduct.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)
    size = serializers.CharField(max_length=40, allow_blank=True, required=False, default="")
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerOrderStatusHistory
        fields = ["previous_status", "status", "note", "changed_by_name", "created_at"]

    def get_changed_by_name(self, entry) -> str:
        if entry.changed_by is None:
            return "System"
        return entry.changed_by.get_full_name() or entry.changed_by.username


class CustomerOrderSerializer(serializers.ModelSerializer):
    lines = OrderInputLineSerializer(many=True, write_only=True, allow_empty=False, required=False)
    items = OrderLineSerializer(source="lines", many=True, read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True, default="")
    customer = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    status_history = serializers.SerializerMethodField()
    payment_status = serializers.CharField(read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    payments = serializers.SerializerMethodField()
    sale_id = serializers.SerializerMethodField()
    idempotency_key = serializers.CharField(max_length=80, write_only=True, required=True)
    status_note = serializers.CharField(max_length=240, write_only=True, required=False, allow_blank=True)

    class Meta:
        model = CustomerOrder
        fields = [
            "id",
            "order_number",
            "location",
            "location_name",
            "customer_name",
            "customer",
            "customer_phone",
            "customer_email",
            "fulfillment",
            "delivery_address",
            "requested_for",
            "status",
            "payment_status",
            "total",
            "amount_paid",
            "amount_due",
            "payments",
            "sale_id",
            "source",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "status_history",
            "lines",
            "items",
            "idempotency_key",
            "status_note",
        ]
        read_only_fields = [
            "order_number",
            "created_by",
            "created_at",
            "updated_at",
            "payment_status",
            "total",
            "amount_paid",
            "amount_due",
            "payments",
            "status_history",
        ]

    def validate_source(self, value):
        if value == CustomerOrder.Source.WEBSITE:
            raise serializers.ValidationError("Website orders must come through the public order form.")
        return value

    def get_created_by_name(self, order) -> str:
        if order.created_by is None:
            return ""
        return order.created_by.get_full_name() or order.created_by.username

    def get_sale_id(self, order) -> int | None:
        sale = getattr(order, "sale", None)
        return sale.pk if sale else None

    def get_payments(self, order):
        return PaymentSerializer(order.payments.all(), many=True).data

    @extend_schema_field(OrderStatusHistorySerializer(many=True))
    def get_status_history(self, order):
        return OrderStatusHistorySerializer(
            order.status_history.select_related("changed_by"),
            many=True,
        ).data

    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        requested_location = validated_data.pop("location", None)
        idempotency_key = validated_data.pop("idempotency_key")
        validated_data.pop("status_note", None)
        if requested_location and requested_location != self.context["location"]:
            raise serializers.ValidationError({"location": "Choose the active location for this request."})
        if validated_data.pop("status", CustomerOrder.Status.NEW) != CustomerOrder.Status.NEW:
            raise serializers.ValidationError({"status": "New orders must start with the New status."})
        return create_order(
            location=self.context["location"],
            actor=self.context["request"].user,
            lines=lines,
            idempotency_key=idempotency_key,
            **validated_data,
        )

    def update(self, instance, validated_data):
        if "lines" in validated_data:
            raise serializers.ValidationError({"lines": "Order items cannot be edited after an order is created."})
        validated_data.pop("status_note", None)
        return super().update(instance, validated_data)


class PublicOrderRequestSerializer(serializers.Serializer):
    customerName = serializers.CharField(max_length=160, trim_whitespace=True)
    phone = serializers.CharField(max_length=40, trim_whitespace=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    cakeId = serializers.SlugField(max_length=80)
    size = serializers.CharField(max_length=40, trim_whitespace=True)
    quantity = serializers.IntegerField(min_value=1, max_value=20)
    instructions = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    fulfillment = serializers.ChoiceField(choices=CustomerOrder.Fulfillment.choices)
    requestedDate = serializers.DateField()
    deliveryAddress = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    idempotencyKey = serializers.CharField(max_length=80)

    def validate(self, attrs):
        if attrs["fulfillment"] == CustomerOrder.Fulfillment.DELIVERY and not attrs.get("deliveryAddress", "").strip():
            raise serializers.ValidationError({"deliveryAddress": "Enter a delivery address."})
        return attrs

    def create(self, validated_data):
        from website.models import WebsiteSettings

        website_is_managed = WebsiteSettings.objects.filter(pk=1, is_published=True).exists()
        try:
            products = CakeProduct.objects.filter(web_id=validated_data["cakeId"], is_active=True)
            if website_is_managed:
                products = products.filter(is_published=True)
            product = products.get()
        except CakeProduct.DoesNotExist:
            raise serializers.ValidationError({"cakeId": "This cake is not currently available to order."}) from None

        requested_at = timezone.make_aware(
            datetime.combine(validated_data["requestedDate"], time.min),
        )
        return create_order(
            location=None,
            actor=None,
            source=CustomerOrder.Source.WEBSITE,
            idempotency_key=validated_data["idempotencyKey"],
            customer_name=validated_data["customerName"],
            customer_phone=validated_data["phone"],
            customer_email=validated_data.get("email", ""),
            fulfillment=validated_data["fulfillment"],
            delivery_address=validated_data.get("deliveryAddress", ""),
            requested_for=requested_at,
            notes=validated_data.get("instructions", ""),
            lines=[
                {
                    "product": product,
                    "quantity": validated_data["quantity"],
                    "size": validated_data["size"],
                },
            ],
        )


class SaleLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = SaleLine
        fields = ["id", "product", "product_name", "quantity", "unit_price", "total"]
        read_only_fields = ["total"]


class SaleInputLineSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=CakeProduct.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
    )


class PaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    bank_name = serializers.CharField(max_length=80, trim_whitespace=True, required=False, default="")
    payment_date = serializers.DateField(required=False)

    def validate(self, attrs):
        bank_name = attrs.get("bank_name", "").strip()
        if attrs["method"] == Payment.Method.BANK_TRANSFER and not bank_name:
            raise serializers.ValidationError({"bank_name": "Enter the bank name for a bank transfer."})
        if attrs["method"] != Payment.Method.BANK_TRANSFER and bank_name:
            raise serializers.ValidationError({"bank_name": "Bank name is only used for bank transfers."})
        attrs["bank_name"] = bank_name
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    received_by = serializers.PrimaryKeyRelatedField(read_only=True)
    received_by_name = serializers.CharField(source="received_by.username", read_only=True)
    received_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "method",
            "amount",
            "bank_name",
            "payment_date",
            "received_by",
            "received_by_name",
            "received_at",
        ]
        read_only_fields = ["id", "received_by", "received_at"]


class SaleRefundLineInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=CakeProduct.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class SaleRefundLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleRefundLine
        fields = ["product", "product_name", "quantity"]


class SaleRefundInputSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=80)
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    bank_name = serializers.CharField(max_length=80, trim_whitespace=True, required=False, default="")
    refund_date = serializers.DateField(required=False)
    reason = serializers.CharField(max_length=240, trim_whitespace=True)
    items = SaleRefundLineInputSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        if attrs["method"] == Payment.Method.BANK_TRANSFER and not attrs["bank_name"].strip():
            raise serializers.ValidationError({"bank_name": "Enter the bank name for a bank transfer refund."})
        if attrs["method"] != Payment.Method.BANK_TRANSFER and attrs["bank_name"].strip():
            raise serializers.ValidationError({"bank_name": "Bank name is only used for bank transfers."})
        products = [item["product"].pk for item in attrs["items"]]
        if len(products) != len(set(products)):
            raise serializers.ValidationError({"items": "Each returned cake can only appear once."})
        if not attrs["reason"].strip():
            raise serializers.ValidationError({"reason": "Enter a refund reason."})
        attrs["bank_name"] = attrs["bank_name"].strip()
        attrs["reason"] = attrs["reason"].strip()
        return attrs

    def create(self, validated_data):
        items = validated_data.pop("items")
        return refund_sale(
            sale=self.context["sale"],
            actor=self.context["request"].user,
            items=items,
            **validated_data,
        )


class SaleRefundSerializer(serializers.ModelSerializer):
    refunded_by_name = serializers.CharField(source="refunded_by.username", read_only=True)
    lines = SaleRefundLineSerializer(many=True, read_only=True)

    class Meta:
        model = SaleRefund
        fields = [
            "id",
            "method",
            "amount",
            "bank_name",
            "refund_date",
            "reason",
            "refunded_by_name",
            "created_at",
            "lines",
        ]


class SaleCancellationInputSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=80)
    reason = serializers.CharField(max_length=240, trim_whitespace=True)
    confirm_restock = serializers.BooleanField()

    def validate(self, attrs):
        if not attrs["reason"].strip():
            raise serializers.ValidationError({"reason": "Enter a cancellation reason."})
        if not attrs["confirm_restock"]:
            raise serializers.ValidationError({
                "confirm_restock": "Confirm that all cakes from this sale are being returned to stock.",
            })
        attrs["reason"] = attrs["reason"].strip()
        return attrs

    def create(self, validated_data):
        return cancel_sale(
            sale=self.context["sale"],
            actor=self.context["request"].user,
            **validated_data,
        )


class PaymentCaptureSerializer(PaymentInputSerializer):
    idempotency_key = serializers.CharField(max_length=80)

    def create(self, validated_data):
        return collect_sale_payment(
            sale=self.context["sale"],
            actor=self.context["request"].user,
            **validated_data,
        )


class SaleSerializer(serializers.ModelSerializer):
    items = SaleInputLineSerializer(many=True, write_only=True, allow_empty=False)
    lines = SaleLineSerializer(many=True, read_only=True)
    payments = PaymentInputSerializer(many=True, write_only=True, required=False)
    payment_history = PaymentSerializer(source="payments", many=True, read_only=True)
    refunds = SaleRefundSerializer(many=True, read_only=True)
    order = serializers.PrimaryKeyRelatedField(
        queryset=CustomerOrder.objects.all(),
        required=False,
        allow_null=True,
    )
    order_number = serializers.CharField(source="order.order_number", read_only=True, default="")
    cashier_name = serializers.CharField(source="cashier.username", read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    amount_paid = serializers.SerializerMethodField()
    amount_due = serializers.SerializerMethodField()
    amount_refunded = serializers.SerializerMethodField()
    cancellation_reason = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    cancelled_at = serializers.SerializerMethodField()
    idempotency_key = serializers.CharField(max_length=80, write_only=True, required=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "location",
            "cashier",
            "cashier_name",
            "sold_at",
            "created_at",
            "status",
            "note",
            "order",
            "order_number",
            "items",
            "lines",
            "payments",
            "payment_history",
            "total",
            "amount_paid",
            "amount_due",
            "amount_refunded",
            "refunds",
            "cancellation_reason",
            "cancelled_by_name",
            "cancelled_at",
            "idempotency_key",
        ]
        read_only_fields = ["location", "cashier", "created_at", "status"]

    def get_amount_paid(self, sale) -> Decimal:
        return sale.payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    def get_amount_due(self, sale) -> Decimal:
        if sale.status == Sale.Status.CANCELLED:
            return Decimal("0.00")
        return max(sale.total - self.get_amount_paid(sale), Decimal("0.00"))

    def get_amount_refunded(self, sale) -> Decimal:
        return sale.refunds.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    def get_cancellation_reason(self, sale) -> str:
        cancellation = getattr(sale, "cancellation", None)
        return cancellation.reason if cancellation else ""

    def get_cancelled_by_name(self, sale) -> str:
        cancellation = getattr(sale, "cancellation", None)
        if cancellation is None:
            return ""
        return cancellation.cancelled_by.get_full_name() or cancellation.cancelled_by.username

    def get_cancelled_at(self, sale) -> datetime | None:
        cancellation = getattr(sale, "cancellation", None)
        return cancellation.cancelled_at if cancellation else None

    def create(self, validated_data):
        items = validated_data.pop("items")
        payments = validated_data.pop("payments", [])
        idempotency_key = validated_data.pop("idempotency_key")
        return create_sale(
            location=self.context["location"],
            actor=self.context["request"].user,
            items=items,
            payments=payments,
            idempotency_key=idempotency_key,
            **validated_data,
        )


class SaleAvailabilityItemSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    available_quantity = serializers.DecimalField(max_digits=14, decimal_places=3)


class SaleAvailabilitySerializer(serializers.Serializer):
    products = SaleAvailabilityItemSerializer(many=True)


class AuditEventSerializer(serializers.ModelSerializer):
    location_name = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "location",
            "location_name",
            "actor",
            "actor_name",
            "action",
            "summary",
            "target_type",
            "target_id",
            "created_at",
        ]

    def get_location_name(self, event) -> str:
        return event.location.name if event.location else ""

    def get_actor_name(self, event) -> str:
        return event.actor.get_full_name() or event.actor.username if event.actor else "System"


class InventoryResponseSerializer(serializers.Serializer):
    ingredients = IngredientBalanceSerializer(many=True)
    products = ProductBalanceSerializer(many=True)

class StockTransferReceiptSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(source="received_by.username", read_only=True)

    class Meta:
        model = StockTransferReceipt
        fields = [
            "id",
            "quantity",
            "is_final",
            "discrepancy_quantity",
            "discrepancy_note",
            "received_by_name",
            "received_at",
        ]


class StockTransferSerializer(serializers.ModelSerializer):
    source_location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
    )
    destination_location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
    )
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    product = serializers.PrimaryKeyRelatedField(
        queryset=CakeProduct.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    item_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.CharField(source="recorded_by.username", read_only=True)
    received_by_name = serializers.SerializerMethodField()
    shipment_id = serializers.IntegerField(read_only=True, allow_null=True)
    remaining_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    receipts = serializers.SerializerMethodField()

    class Meta:
        model = StockTransfer
        fields = [
            "id",
            "shipment_id",
            "source_location",
            "destination_location",
            "ingredient",
            "product",
            "item_name",
            "quantity",
            "received_quantity",
            "remaining_quantity",
            "status",
            "reference",
            "note",
            "recorded_by",
            "recorded_by_name",
            "received_by_name",
            "received_at",
            "receipts",
            "created_at",
        ]
        read_only_fields = [
            "recorded_by",
            "received_by",
            "received_by_name",
            "received_at",
            "received_quantity",
            "remaining_quantity",
            "receipts",
            "created_at",
            "status",
            "shipment_id",
        ]

    def get_item_name(self, transfer) -> str:
        item = transfer.ingredient or transfer.product
        return item.name if item else ""

    def get_received_by_name(self, transfer) -> str:
        return transfer.received_by.get_full_name() or transfer.received_by.username if transfer.received_by else ""

    @extend_schema_field(StockTransferReceiptSerializer(many=True))
    def get_receipts(self, transfer):
        return StockTransferReceiptSerializer(
            transfer.receipts.select_related("received_by"),
            many=True,
        ).data

    def validate(self, attrs):
        if attrs["source_location"] == attrs["destination_location"]:
            raise serializers.ValidationError({"destination_location": "Choose a different destination location."})
        if (attrs.get("ingredient") is None) == (attrs.get("product") is None):
            raise serializers.ValidationError("Choose exactly one ingredient or cake product.")
        return attrs

    def create(self, validated_data):
        source = validated_data.pop("source_location")
        destination = validated_data.pop("destination_location")
        ingredient = validated_data.pop("ingredient", None)
        product = validated_data.pop("product", None)
        return transfer_stock(
            source=source,
            destination=destination,
            actor=self.context["request"].user,
            ingredient=ingredient,
            product=product,
            **validated_data,
        )


class TransferItemInputSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.filter(is_active=True),
        required=False,
    )
    product = serializers.PrimaryKeyRelatedField(
        queryset=CakeProduct.objects.filter(is_active=True),
        required=False,
    )
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))

    def validate(self, attrs):
        if (attrs.get("ingredient") is None) == (attrs.get("product") is None):
            raise serializers.ValidationError("Choose exactly one ingredient or cake product.")
        return attrs


class TransferDispatchSerializer(serializers.Serializer):
    source_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_active=True))
    destination_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_active=True))
    items = TransferItemInputSerializer(many=True, allow_empty=False)
    idempotency_key = serializers.CharField(max_length=80)
    reference = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")
    note = serializers.CharField(max_length=240, allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if attrs["source_location"] == attrs["destination_location"]:
            raise serializers.ValidationError({"destination_location": "Choose a different destination location."})
        return attrs


class TransferReceiptInputSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(max_length=80)
    quantity = serializers.DecimalField(
        max_digits=14,
        decimal_places=3,
        min_value=Decimal("0"),
        required=False,
    )
    is_final = serializers.BooleanField(default=True)
    discrepancy_note = serializers.CharField(max_length=240, allow_blank=True, required=False, default="")


class StockAdjustmentSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.filter(is_active=True),
        required=False,
    )
    product = serializers.PrimaryKeyRelatedField(
        queryset=CakeProduct.objects.filter(is_active=True),
        required=False,
    )
    quantity_delta = serializers.DecimalField(max_digits=14, decimal_places=3)
    note = serializers.CharField(max_length=240)

    def validate(self, attrs):
        if (attrs.get("ingredient") is None) == (attrs.get("product") is None):
            raise serializers.ValidationError("Choose exactly one ingredient or cake product.")
        if attrs["quantity_delta"] == 0:
            raise serializers.ValidationError({"quantity_delta": "Adjustment cannot be zero."})
        if not attrs["note"].strip():
            raise serializers.ValidationError({"note": "Explain why this stock adjustment is needed."})
        return attrs

    def create(self, validated_data):
        return record_stock(
            location=self.context["location"],
            actor=self.context["request"].user,
            kind=StockMovement.Kind.ADJUSTMENT,
            **validated_data,
        )
