from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.db.models import F, Q, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    AuditEvent,
    BusinessSettings,
    CakeProduct,
    CatalogCategory,
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
    Sale,
    StockMovement,
    StockTransfer,
    Supplier,
    User,
)
from .services import (
    approve_purchase,
    dispatch_transfer_shipment,
    log_activity,
    receive_transfer,
    record_order_payment,
    reject_purchase,
)
from .units import convert_quantity
from .permissions import (
    HasBusinessPermission,
    _is_owner,
    _required_location,
    _requested_location,
    _scoped,
)
from .serializers import (
    AuditEventSerializer,
    BusinessSettingsSerializer,
    CakeProductSerializer,
    CatalogCategorySerializer,
    CustomerOrderSerializer,
    IngredientBalanceSerializer,
    IngredientPurchaseSerializer,
    IngredientSerializer,
    InventoryResponseSerializer,
    LocationSerializer,
    PaymentCaptureSerializer,
    PaymentSerializer,
    ProductionBatchSerializer,
    ProductBalanceSerializer,
    PublicOrderRequestSerializer,
    PublicOrderResponseSerializer,
    PurchaseRejectionSerializer,
    RecipeSerializer,
    SaleSerializer,
    SaleCancellationInputSerializer,
    SaleAvailabilitySerializer,
    SaleRefundInputSerializer,
    SaleRefundSerializer,
    StockAdjustmentSerializer,
    StockMovementSerializer,
    StockTransferSerializer,
    TransferDispatchSerializer,
    TransferReceiptInputSerializer,
    SupplierSerializer,
)


class LocationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LocationSerializer
    queryset = Location.objects.all()
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permissions_any = ("dashboard", "transfers")
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "kind"]

    def get_queryset(self):
        if _is_owner(self.request.user):
            return Location.objects.all()
        if "transfers" in self.request.user.effective_business_permissions:
            return Location.objects.filter(is_active=True)
        if self.request.user.location_id is None:
            return Location.objects.none()
        return Location.objects.filter(pk=self.request.user.location_id)


class CakeProductViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CakeProductSerializer
    queryset = CakeProduct.objects.all().select_related("category")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permissions_any = (
        "dashboard",
        "orders",
        "sales",
        "inventory",
        "production",
        "recipes",
    )
    search_fields = ["name", "sku", "description", "category__name"]
    ordering_fields = ["name", "sku", "unit_price"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update"}:
            self.required_permission = "catalog"
            self.required_permissions_any = ()
        else:
            self.required_permission = None
            self.required_permissions_any = (
                "dashboard",
                "orders",
                "sales",
                "inventory",
                "production",
                "recipes",
                "catalog",
            )
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        if "catalog" not in self.request.user.effective_business_permissions:
            queryset = queryset.filter(is_active=True)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        public_fields = {"is_published", "is_featured", "public_sort_order"}
        if any(serializer.validated_data.get(field) not in (None, False, 0) for field in public_fields):
            if "website_content" not in self.request.user.effective_business_permissions:
                raise PermissionDenied("Your account cannot publish or feature website products.")
        product = serializer.save()
        action = "product_publish" if product.is_published else "product_create"
        log_activity(
            location=None,
            actor=self.request.user,
            action=action,
            summary=f"{'Published' if product.is_published else 'Created'} cake product {product.name}.",
            target_type="cake_product",
            target_id=product.pk,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        public_fields_changed = any(
            field in serializer.validated_data
            and serializer.validated_data[field] != getattr(serializer.instance, field)
            for field in {"is_published", "is_featured", "public_sort_order"}
        )
        availability_changed = (
            serializer.instance.is_published
            and "is_active" in serializer.validated_data
            and serializer.validated_data["is_active"] != serializer.instance.is_active
        )
        if public_fields_changed or availability_changed:
            if "website_content" not in self.request.user.effective_business_permissions:
                raise PermissionDenied("Your account cannot change public product visibility or availability.")
        was_published = serializer.instance.is_published
        product = serializer.save()
        action = "product_update"
        if product.is_published and not was_published:
            action = "product_publish"
        elif was_published and not product.is_published:
            action = "product_unpublish"
        log_activity(
            location=None,
            actor=self.request.user,
            action=action,
            summary=(
                f"{'Published' if action == 'product_publish' else 'Unpublished' if action == 'product_unpublish' else 'Updated'} "
                f"cake product {product.name}."
            ),
            target_type="cake_product",
            target_id=product.pk,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.is_published and (
            "website_content" not in self.request.user.effective_business_permissions
        ):
            raise PermissionDenied("Your account cannot delete a published website product.")
        product_id = instance.pk
        product_name = instance.name
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {"product": "This cake is referenced by recipes, stock, or orders. Deactivate it instead."},
            ) from None
        log_activity(
            location=None,
            actor=self.request.user,
            action="product_delete",
            summary=f"Deleted cake product {product_name}.",
            target_type="cake_product",
            target_id=product_id,
        )


class CatalogCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CatalogCategorySerializer
    queryset = CatalogCategory.objects.all()
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permissions_any = ("dashboard", "orders", "inventory", "production", "recipes", "catalog")
    search_fields = ["name"]
    ordering_fields = ["kind", "name", "sort_order"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            self.required_permission = "catalog"
            self.required_permissions_any = ()
        else:
            self.required_permission = None
            self.required_permissions_any = ("dashboard", "orders", "inventory", "production", "recipes", "catalog")
        return super().get_permissions()

    @transaction.atomic
    def perform_create(self, serializer):
        if serializer.validated_data.get("is_published") and (
            "website_content" not in self.request.user.effective_business_permissions
        ):
            raise PermissionDenied("Your account cannot publish website categories.")
        category = serializer.save()
        action = "catalog_category_publish" if category.is_published else "catalog_category_create"
        log_activity(
            location=None,
            actor=self.request.user,
            action=action,
            summary=f"{'Published' if category.is_published else 'Created'} catalog category {category.name}.",
            target_type="catalog_category",
            target_id=category.pk,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        visibility_changed = (
            "is_published" in serializer.validated_data
            and serializer.validated_data["is_published"] != serializer.instance.is_published
        )
        availability_changed = (
            serializer.instance.is_published
            and "is_active" in serializer.validated_data
            and serializer.validated_data["is_active"] != serializer.instance.is_active
        )
        if (visibility_changed or availability_changed) and (
            "website_content" not in self.request.user.effective_business_permissions
        ):
            raise PermissionDenied("Your account cannot publish website categories.")
        was_published = serializer.instance.is_published
        category = serializer.save()
        action = "catalog_category_update"
        if category.is_published and not was_published:
            action = "catalog_category_publish"
        elif was_published and not category.is_published:
            action = "catalog_category_unpublish"
        log_activity(
            location=None,
            actor=self.request.user,
            action=action,
            summary=f"Updated catalog category {category.name}.",
            target_type="catalog_category",
            target_id=category.pk,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.is_published and (
            "website_content" not in self.request.user.effective_business_permissions
        ):
            raise PermissionDenied("Your account cannot delete a published website category.")
        category_id = instance.pk
        category_name = instance.name
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {"category": "This category is used by products or ingredients. Deactivate it instead."},
            ) from None
        log_activity(
            location=None,
            actor=self.request.user,
            action="catalog_category_delete",
            summary=f"Deleted catalog category {category_name}.",
            target_type="catalog_category",
            target_id=category_id,
        )


class IngredientViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = IngredientSerializer
    queryset = Ingredient.objects.all().select_related("category").prefetch_related("suppliers")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permissions_any = ("inventory", "production", "purchases", "recipes")
    search_fields = ["name", "category__name", "suppliers__name"]
    ordering_fields = ["name", "unit", "reorder_level"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update"}:
            self.required_permission = "catalog"
            self.required_permissions_any = ()
        else:
            self.required_permission = None
            self.required_permissions_any = ("inventory", "production", "purchases", "recipes", "catalog")
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        if "catalog" not in self.request.user.effective_business_permissions:
            queryset = queryset.filter(is_active=True)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        ingredient = serializer.save()
        log_activity(
            location=None,
            actor=self.request.user,
            action="ingredient_create",
            summary=f"Created ingredient {ingredient.name}.",
            target_type="ingredient",
            target_id=ingredient.pk,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        ingredient = serializer.save()
        log_activity(
            location=None,
            actor=self.request.user,
            action="ingredient_update",
            summary=f"Updated ingredient {ingredient.name}.",
            target_type="ingredient",
            target_id=ingredient.pk,
        )


class SupplierViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "purchases"
    search_fields = ["name", "phone"]
    ordering_fields = ["name"]


class RecipeViewSet(viewsets.GenericViewSet, mixins.ListModelMixin, mixins.CreateModelMixin):
    serializer_class = RecipeSerializer
    queryset = Recipe.objects.select_related("product", "created_by").prefetch_related("ingredients__ingredient")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "recipes"
    search_fields = ["product__name", "created_by__username"]
    ordering_fields = ["product__name", "version", "created_at"]

    def get_permissions(self):
        if self.action == "create":
            self.required_permission = "recipes_manage"
        return super().get_permissions()

    @transaction.atomic
    def perform_create(self, serializer):
        recipe = serializer.save()
        log_activity(
            location=None,
            actor=self.request.user,
            action="recipe_create",
            summary=f"Created recipe v{recipe.version} for {recipe.product.name}.",
            target_type="recipe",
            target_id=recipe.pk,
        )


class LocationScopedViewSet(viewsets.GenericViewSet):
    required_location_kind = None
    filter_query_params = {}
    search_fields = []
    ordering_fields = []

    def get_queryset(self):
        return _scoped(super().get_queryset(), self.request.user, self.request)

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        for query_param, model_field in self.filter_query_params.items():
            value = self.request.query_params.get(query_param)
            if value is None:
                continue
            try:
                queryset = queryset.filter(**{model_field: value})
            except (DjangoValidationError, TypeError, ValueError):
                raise ValidationError({query_param: "Enter a valid filter value."}) from None
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "create":
            location = _required_location(self.request.user, self.request)
            if (
                self.required_location_kind
                and location.kind != Location.Kind.OTHER
                and location.kind != self.required_location_kind
            ):
                raise ValidationError({
                    "location": f"This operation must be recorded at a {self.required_location_kind.replace('_', ' ')} location.",
                })
            context["location"] = location
        return context


class PurchaseViewSet(LocationScopedViewSet, mixins.ListModelMixin, mixins.CreateModelMixin):
    serializer_class = IngredientPurchaseSerializer
    queryset = IngredientPurchase.objects.select_related(
        "location",
        "supplier",
        "recorded_by",
        "approved_by",
    ).prefetch_related("lines__ingredient")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "purchases"
    required_location_kind = Location.Kind.HOME_BAKERY
    search_fields = ["supplier__name", "reference", "note", "recorded_by__username"]
    ordering_fields = ["purchased_at", "created_at", "status", "id"]
    filter_query_params = {"status": "status", "supplier": "supplier_id"}

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        if not _is_owner(request.user) and "purchases_approve" not in request.user.effective_business_permissions:
            raise PermissionDenied("Your account cannot approve ingredient purchases.")
        purchase = approve_purchase(purchase=self.get_object(), actor=request.user)
        return Response(self.get_serializer(purchase).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        if not _is_owner(request.user) and "purchases_approve" not in request.user.effective_business_permissions:
            raise PermissionDenied("Your account cannot reject ingredient purchases.")
        serializer = PurchaseRejectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase = reject_purchase(
            purchase=self.get_object(),
            actor=request.user,
            reason=serializer.validated_data["reason"].strip(),
        )
        return Response(self.get_serializer(purchase).data)

    def get_permissions(self):
        if self.action in {"approve", "reject"}:
            self.required_permission = "purchases_approve"
        return super().get_permissions()

    def perform_create(self, serializer):
        if serializer.validated_data.get("idempotency_key") is None:
            raise ValidationError({"idempotency_key": "A unique purchase request key is required."})
        serializer.save()


class ProductionViewSet(LocationScopedViewSet, mixins.ListModelMixin, mixins.CreateModelMixin):
    serializer_class = ProductionBatchSerializer
    queryset = ProductionBatch.objects.select_related(
        "location",
        "product",
        "recorded_by",
        "recipe",
    ).prefetch_related("consumptions__ingredient")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "production"
    required_location_kind = Location.Kind.HOME_BAKERY
    search_fields = ["product__name", "note", "recorded_by__username"]
    ordering_fields = ["produced_at", "created_at", "quantity", "id"]
    filter_query_params = {"product": "product_id"}

    @action(detail=False, methods=["get"], url_path="requirements")
    def requirements(self, request):
        location = _required_location(request.user, request)
        if location.kind not in {Location.Kind.HOME_BAKERY, Location.Kind.OTHER}:
            raise ValidationError({"location": "Production requirements are available at the Home Bakery."})
        try:
            product_id = int(request.query_params["product"])
            quantity = int(request.query_params["quantity"])
            product = CakeProduct.objects.get(pk=product_id, is_active=True)
        except (KeyError, ValueError, CakeProduct.DoesNotExist):
            raise ValidationError({"product": "Choose an active cake and a whole production quantity."}) from None
        if quantity < 1:
            raise ValidationError({"quantity": "Production quantity must be at least one."})
        recipe = Recipe.objects.filter(product=product, is_current=True).prefetch_related(
            "ingredients__ingredient",
        ).first()
        if recipe is None or not recipe.ingredients.exists():
            raise ValidationError({"product": "Add a complete current recipe before planning production."})
        requirements = []
        for line in recipe.ingredients.all():
            required = convert_quantity(
                line.quantity * quantity,
                line.unit,
                line.ingredient.unit,
            )
            balance = IngredientBalance.objects.filter(
                location=location,
                ingredient=line.ingredient,
            ).first()
            reserved = StockTransfer.objects.filter(
                source_location=location,
                ingredient=line.ingredient,
                legacy_source_deducted=False,
                status__in=[
                    StockTransfer.Status.IN_TRANSIT,
                    StockTransfer.Status.PARTIALLY_RECEIVED,
                ],
            ).aggregate(total=Sum(F("quantity") - F("received_quantity")))["total"] or Decimal("0")
            available = max((balance.quantity if balance else Decimal("0")) - reserved, Decimal("0"))
            requirements.append({
                "ingredient": line.ingredient_id,
                "ingredient_name": line.ingredient.name,
                "recipe_quantity": str(line.quantity * quantity),
                "recipe_unit": line.unit,
                "required_quantity": str(required),
                "unit": line.ingredient.unit,
                "available_quantity": str(available),
                "sufficient": available >= required,
            })
        return Response({
            "product": product.pk,
            "product_name": product.name,
            "quantity": quantity,
            "recipe_version": recipe.version,
            "ingredients": requirements,
        })


class OrderViewSet(
    LocationScopedViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
):
    serializer_class = CustomerOrderSerializer
    queryset = CustomerOrder.objects.select_related("location", "created_by").prefetch_related(
        "lines__product",
        "payments__received_by",
        "status_history__changed_by",
        "sale__lines",
        "sale__payments",
        "sale__refunds",
    )
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "orders"
    required_location_kind = Location.Kind.CAFE
    http_method_names = ["get", "post", "patch", "head", "options"]
    search_fields = ["order_number", "customer_name", "customer_phone", "customer_email"]
    ordering_fields = ["requested_for", "created_at", "updated_at", "status", "order_number"]
    filter_query_params = {"status": "status", "source": "source"}

    transitions = {
        CustomerOrder.Status.NEW: {CustomerOrder.Status.CONFIRMED, CustomerOrder.Status.CANCELLED},
        CustomerOrder.Status.CONFIRMED: {CustomerOrder.Status.IN_PRODUCTION, CustomerOrder.Status.CANCELLED},
        CustomerOrder.Status.IN_PRODUCTION: {CustomerOrder.Status.READY, CustomerOrder.Status.CANCELLED},
        CustomerOrder.Status.READY: {CustomerOrder.Status.COMPLETED, CustomerOrder.Status.CANCELLED},
        CustomerOrder.Status.COMPLETED: set(),
        CustomerOrder.Status.CANCELLED: set(),
    }

    @transaction.atomic
    def perform_update(self, serializer):
        current = self.get_object()
        current = CustomerOrder.objects.select_for_update().get(pk=current.pk)
        status_note = serializer.validated_data.pop("status_note", "").strip()
        if "location" in serializer.validated_data:
            if not _is_owner(self.request.user):
                raise PermissionDenied("Only owners can assign an order to a location.")
            if serializer.validated_data["location"] is None:
                raise ValidationError({"location": "Assign the order to an active location."})
        changed_fields = [
            field
            for field, value in serializer.validated_data.items()
            if getattr(current, field) != value
        ]
        next_status = serializer.validated_data.get("status", current.status)
        if next_status != current.status and next_status not in self.transitions[current.status]:
            raise ValidationError({"status": f"An order cannot move from {current.status} to {next_status}."})
        order = serializer.save()
        if next_status != current.status:
            CustomerOrderStatusHistory.objects.create(
                order=order,
                previous_status=current.status,
                status=order.status,
                note=status_note,
                changed_by=self.request.user,
            )
        if changed_fields:
            changes = [
                f"status changed to {order.status.replace('_', ' ')}"
                if field == "status"
                else f"assigned to {order.location.name if order.location else 'unassigned'}"
                if field == "location"
                else f"edited {field.replace('_', ' ')}"
                for field in changed_fields
            ]
            log_activity(
                location=order.location,
                actor=self.request.user,
                action="order_update",
                summary=f"Updated order #{order.pk}: {', '.join(changes)}.",
                target_type="customer_order",
                target_id=order.pk,
            )

    @action(detail=True, methods=["post"], url_path="payments")
    @transaction.atomic
    def record_payment(self, request, pk=None):
        order = self.get_object()
        serializer = PaymentCaptureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = record_order_payment(
            order=order,
            actor=request.user,
            method=data["method"],
            amount=data["amount"],
            idempotency_key=data["idempotency_key"],
            bank_name=data.get("bank_name", ""),
            payment_date=data.get("payment_date"),
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PublicOrderRequestView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_order"

    @extend_schema(request=PublicOrderRequestSerializer, responses=PublicOrderResponseSerializer)
    def post(self, request):
        serializer = PublicOrderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(
            {"detail": "Order request received.", "id": order.pk, "orderNumber": order.order_number},
            status=201,
        )


class SaleViewSet(LocationScopedViewSet, mixins.ListModelMixin, mixins.CreateModelMixin):
    serializer_class = SaleSerializer
    queryset = Sale.objects.select_related(
        "location",
        "cashier",
        "order",
        "cancellation",
    ).prefetch_related(
        "lines__product",
        "payments",
        "refunds__lines__product",
        "refunds__refunded_by",
    )
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "sales"
    required_location_kind = Location.Kind.CAFE
    search_fields = [
        "cashier__username",
        "order__order_number",
        "order__customer_name",
        "lines__product__name",
    ]
    ordering_fields = ["sold_at", "created_at", "status", "id"]
    filter_query_params = {"status": "status", "order": "order_id"}

    @action(detail=False, methods=["get"], url_path="availability")
    @extend_schema(responses=SaleAvailabilitySerializer)
    def availability(self, request):
        location = _required_location(request.user, request)
        if location.kind not in {Location.Kind.CAFE, Location.Kind.OTHER}:
            raise ValidationError({"location": "Sales availability is only available at a café location."})
        balances = {
            row["product_id"]: row["quantity"]
            for row in ProductBalance.objects.filter(location=location).values("product_id", "quantity")
        }
        reservations = {
            row["product_id"]: row["quantity"] or Decimal("0")
            for row in StockTransfer.objects.filter(
                source_location=location,
                legacy_source_deducted=False,
                status__in=[
                    StockTransfer.Status.IN_TRANSIT,
                    StockTransfer.Status.PARTIALLY_RECEIVED,
                ],
                product__isnull=False,
            ).values("product_id").annotate(
                quantity=Sum(F("quantity") - F("received_quantity")),
            )
        }
        return Response({
            "products": [
                {
                    "product": product.pk,
                    "available_quantity": str(max(
                        balances.get(product.pk, Decimal("0")) - reservations.get(product.pk, Decimal("0")),
                        Decimal("0"),
                    )),
                }
                for product in CakeProduct.objects.filter(is_active=True).order_by("name")
            ],
        })

    @action(detail=True, methods=["post"], url_path="payments")
    def payments(self, request, pk=None):
        sale = self.get_object()
        serializer = PaymentCaptureSerializer(
            data=request.data,
            context={"request": request, "sale": sale},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="refunds")
    def refunds(self, request, pk=None):
        sale = self.get_object()
        serializer = SaleRefundInputSerializer(
            data=request.data,
            context={"request": request, "sale": sale},
        )
        serializer.is_valid(raise_exception=True)
        refund = serializer.save()
        return Response(SaleRefundSerializer(refund).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        sale = self.get_object()
        serializer = SaleCancellationInputSerializer(
            data=request.data,
            context={"request": request, "sale": sale},
        )
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        sale.refresh_from_db()
        return Response(self.get_serializer(sale).data)


class MovementViewSet(LocationScopedViewSet, mixins.ListModelMixin):
    serializer_class = StockMovementSerializer
    queryset = StockMovement.objects.select_related("location", "ingredient", "product", "actor")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "inventory"
    search_fields = ["ingredient__name", "product__name", "reference", "note", "actor__username"]
    ordering_fields = ["created_at", "kind", "quantity_delta", "id"]
    filter_query_params = {
        "kind": "kind",
        "ingredient": "ingredient_id",
        "product": "product_id",
    }


class AuditEventViewSet(LocationScopedViewSet, mixins.ListModelMixin):
    serializer_class = AuditEventSerializer
    queryset = AuditEvent.objects.select_related("location", "actor")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "audit"
    search_fields = ["summary", "action", "target_type", "target_id", "actor__username"]
    ordering_fields = ["created_at", "action", "target_type", "id"]
    filter_query_params = {"action": "action", "target_type": "target_type", "actor": "actor_id"}


class TransferViewSet(LocationScopedViewSet, mixins.ListModelMixin, mixins.CreateModelMixin):
    serializer_class = StockTransferSerializer
    queryset = StockTransfer.objects.select_related(
        "source_location",
        "destination_location",
        "ingredient",
        "product",
        "recorded_by",
        "received_by",
    ).prefetch_related("receipts__received_by")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "transfers"
    search_fields = ["product__name", "ingredient__name", "recorded_by__username", "destination_location__name"]
    ordering_fields = ["created_at", "status", "quantity", "id"]
    filter_query_params = {
        "status": "status",
        "source": "source_location_id",
        "destination": "destination_location_id",
    }

    def get_serializer_context(self):
        return viewsets.GenericViewSet.get_serializer_context(self)

    def get_queryset(self):
        if not _is_owner(self.request.user):
            if self.request.user.location_id is None:
                return StockTransfer.objects.none()
            return self.queryset.filter(
                Q(source_location_id=self.request.user.location_id)
                | Q(destination_location_id=self.request.user.location_id),
            )
        location_id = self.request.query_params.get("location")
        queryset = self.queryset
        if location_id:
            queryset = queryset.filter(source_location_id=location_id) | queryset.filter(
                destination_location_id=location_id,
            )
        return queryset

    def perform_create(self, serializer):
        source = serializer.validated_data["source_location"]
        if not _is_owner(self.request.user) and source.pk != self.request.user.location_id:
            raise PermissionDenied("You can only dispatch stock from your assigned location.")
        if not serializer.validated_data["destination_location"].is_active:
            raise ValidationError({"destination_location": "Choose an active destination location."})
        serializer.save()

    @action(detail=False, methods=["post"], url_path="dispatch")
    def dispatch_shipment(self, request):
        serializer = TransferDispatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source = serializer.validated_data["source_location"]
        if not _is_owner(request.user) and source.pk != request.user.location_id:
            raise PermissionDenied("You can only dispatch stock from your assigned location.")
        if not serializer.validated_data["destination_location"].is_active:
            raise ValidationError({"destination_location": "Choose an active destination location."})
        transfers = dispatch_transfer_shipment(
            source=serializer.validated_data["source_location"],
            destination=serializer.validated_data["destination_location"],
            actor=request.user,
            items=serializer.validated_data["items"],
            reference=serializer.validated_data["reference"],
            note=serializer.validated_data["note"],
            idempotency_key=serializer.validated_data["idempotency_key"],
        )
        return Response(self.get_serializer(transfers, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="receive")
    def receive(self, request, pk=None):
        transfer = self.get_object()
        if not _is_owner(request.user) and transfer.destination_location_id != request.user.location_id:
            raise PermissionDenied("Only the receiving location can confirm this transfer.")
        serializer = TransferReceiptInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer = receive_transfer(
            transfer=transfer,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(self.get_serializer(transfer).data)


class InventoryView(APIView):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "inventory"

    @extend_schema(responses=InventoryResponseSerializer)
    def get(self, request):
        location = _requested_location(request.user, request)
        ingredient_balances = IngredientBalance.objects.select_related("location", "ingredient")
        product_balances = ProductBalance.objects.select_related("location", "product")
        locations = Location.objects.filter(is_active=True)
        if location is not None:
            ingredient_balances = ingredient_balances.filter(location=location)
            product_balances = product_balances.filter(location=location)
            locations = locations.filter(pk=location.pk)
        ingredient_balances = list(ingredient_balances)
        product_balances = list(product_balances)
        ingredients = list(
            Ingredient.objects.filter(is_active=True)
            .select_related("category")
            .prefetch_related("suppliers")
        )
        products = list(CakeProduct.objects.filter(is_active=True))
        existing_ingredient_balances = {
            (balance.location_id, balance.ingredient_id)
            for balance in ingredient_balances
        }
        existing_product_balances = {
            (balance.location_id, balance.product_id)
            for balance in product_balances
        }
        for branch in locations:
            for ingredient in ingredients:
                if (branch.pk, ingredient.pk) not in existing_ingredient_balances:
                    ingredient_balances.append(
                        IngredientBalance(location=branch, ingredient=ingredient, quantity=Decimal("0")),
                    )
            for product in products:
                if (branch.pk, product.pk) not in existing_product_balances:
                    product_balances.append(
                        ProductBalance(location=branch, product=product, quantity=Decimal("0")),
                    )
        reservations = StockTransfer.objects.filter(
            legacy_source_deducted=False,
            status__in=[
                StockTransfer.Status.IN_TRANSIT,
                StockTransfer.Status.PARTIALLY_RECEIVED,
            ],
        )
        if location is not None:
            reservations = reservations.filter(source_location=location)
        ingredient_reservations = {
            (row["source_location_id"], row["ingredient_id"]): row["quantity"]
            for row in reservations.filter(ingredient__isnull=False)
            .values("source_location_id", "ingredient_id")
            .annotate(quantity=Sum(F("quantity") - F("received_quantity")))
        }
        product_reservations = {
            (row["source_location_id"], row["product_id"]): row["quantity"]
            for row in reservations.filter(product__isnull=False)
            .values("source_location_id", "product_id")
            .annotate(quantity=Sum(F("quantity") - F("received_quantity")))
        }
        for balance in ingredient_balances:
            balance.reserved_quantity = ingredient_reservations.get(
                (balance.location_id, balance.ingredient_id),
                Decimal("0"),
            )
        for balance in product_balances:
            balance.reserved_quantity = product_reservations.get(
                (balance.location_id, balance.product_id),
                Decimal("0"),
            )
        return Response({
            "ingredients": IngredientBalanceSerializer(ingredient_balances, many=True).data,
            "products": ProductBalanceSerializer(product_balances, many=True).data,
        })


class StockAdjustmentView(APIView):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "inventory_adjust"

    @extend_schema(request=StockAdjustmentSerializer, responses=StockMovementSerializer)
    def post(self, request):
        context = {
            "request": request,
            "location": _required_location(request.user, request),
        }
        serializer = StockAdjustmentSerializer(data=request.data, context=context)
        serializer.is_valid(raise_exception=True)
        movement = serializer.save()
        return Response(StockMovementSerializer(movement).data, status=201)


class BusinessSettingsView(APIView):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "purchases"

    @extend_schema(responses=BusinessSettingsSerializer)
    def get(self, request):
        return Response(BusinessSettingsSerializer(BusinessSettings.load()).data)

    @extend_schema(request=BusinessSettingsSerializer, responses=BusinessSettingsSerializer)
    def patch(self, request):
        if not _is_owner(request.user):
            raise PermissionDenied("Only an owner can change purchase approval settings.")
        settings = BusinessSettings.load()
        serializer = BusinessSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_activity(
            location=None,
            actor=request.user,
            action="business_settings",
            summary=(
                "Purchase approval is required."
                if settings.require_purchase_approval
                else "Purchase approval is not required."
            ),
            target_type="business_settings",
            target_id=settings.pk,
        )
        return Response(serializer.data)
