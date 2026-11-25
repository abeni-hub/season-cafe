from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seasonops.models import (
    AuditEvent,
    CakeProduct,
    CustomerOrder,
    Ingredient,
    IngredientBalance,
    IngredientPurchase,
    Location,
    Payment,
    ProductBalance,
    ProductionBatch,
    ProductionConsumption,
    Sale,
    SaleRefund,
    StockMovement,
    StockTransfer,
    User,
)
from seasonops.serializers import (
    AuditEventSerializer,
    LocationSerializer,
    StockMovementSerializer,
)
from seasonops.permissions import HasBusinessPermission, _requested_location, _is_owner
from seasonops.services import log_activity

from .serializers import DashboardResponseSerializer, ReportEmployeeSerializer, StaffUserSerializer


class ReportEmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportEmployeeSerializer
    queryset = User.objects.filter(is_active=True).select_related("location").order_by("username", "id")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "reports"
    search_fields = ["username", "first_name", "last_name"]
    ordering_fields = ["username", "first_name", "last_name", "role"]

    def get_queryset(self):
        location = _requested_location(self.request.user, self.request)
        queryset = self.queryset
        if location is not None:
            queryset = queryset.filter(location=location)
        return queryset


class StaffUserViewSet(viewsets.ModelViewSet):
    serializer_class = StaffUserSerializer
    queryset = User.objects.select_related("location").order_by("username", "id")
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permission = "users"
    search_fields = ["username", "first_name", "last_name", "email"]
    ordering_fields = ["username", "first_name", "last_name", "role", "date_joined"]

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset
        if not _is_owner(user):
            queryset = queryset.filter(is_active=True)
            if user.location_id:
                queryset = queryset.filter(location_id=user.location_id)
        else:
            location = _requested_location(user, self.request)
            if location is not None:
                queryset = queryset.filter(location=location)
        return queryset

    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(
            location=user.location,
            actor=self.request.user,
            action="staff_created",
            summary=f"Created staff account {user.get_username()} ({user.role})",
            target_type="user",
            target_id=user.pk,
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_activity(
            location=user.location,
            actor=self.request.user,
            action="staff_updated",
            summary=f"Updated staff account {user.get_username()}",
            target_type="user",
            target_id=user.pk,
        )

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError({"detail": "You cannot delete your own account."})
        if instance.role == User.Role.OWNER and User.objects.filter(role=User.Role.OWNER, is_active=True).count() <= 1:
            raise ValidationError({"detail": "Cannot deactivate the sole active owner account."})
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_activity(
            location=instance.location,
            actor=self.request.user,
            action="staff_deactivated",
            summary=f"Deactivated staff account {instance.get_username()}",
            target_type="user",
            target_id=instance.pk,
        )


def _period_dates(period):
    now = timezone.localtime()
    today = now.date()
    if period == "daily":
        start = today
    elif period == "weekly":
        start = today - timedelta(days=today.weekday())
    elif period == "monthly":
        start = today.replace(day=1)
    else:
        raise ValidationError({"period": "Choose daily, weekly, or monthly."})
    start_at = timezone.make_aware(datetime.combine(start, time.min))
    end_at = timezone.make_aware(datetime.combine(today + timedelta(days=1), time.min))
    return start, start_at, end_at


def _dashboard_dates(request):
    start_value = request.query_params.get("start_date")
    end_value = request.query_params.get("end_date")
    if start_value is None and end_value is None:
        period = request.query_params.get("period", "daily")
        start, start_at, end_at = _period_dates(period)
        return period, start, start_at, end_at
    if not start_value or not end_value:
        raise ValidationError({"date_range": "Choose both a start date and an end date."})
    try:
        start = date.fromisoformat(start_value)
        end = date.fromisoformat(end_value)
    except ValueError:
        raise ValidationError({"date_range": "Enter dates in YYYY-MM-DD format."}) from None
    if end < start:
        raise ValidationError({"end_date": "The end date must not be before the start date."})
    if (end - start).days > 366:
        raise ValidationError({"date_range": "Choose a reporting range of no more than one year."})
    return (
        "custom",
        start,
        timezone.make_aware(datetime.combine(start, time.min)),
        timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min)),
    )


def _report_filter_id(request, name, queryset):
    value = request.query_params.get(name)
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValidationError({name: "Choose a valid record."}) from None
    if parsed < 1 or not queryset.filter(pk=parsed).exists():
        raise ValidationError({name: "Choose a valid record."})
    return parsed


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, HasBusinessPermission]
    required_permissions_any = ("dashboard", "reports")

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="period",
                type=OpenApiTypes.STR,
                enum=["daily", "weekly", "monthly"],
                required=False,
            ),
            OpenApiParameter(name="location", type=OpenApiTypes.INT, required=False),
            OpenApiParameter(name="start_date", type=OpenApiTypes.DATE, required=False),
            OpenApiParameter(name="end_date", type=OpenApiTypes.DATE, required=False),
            OpenApiParameter(name="product", type=OpenApiTypes.INT, required=False),
            OpenApiParameter(
                name="payment_method",
                type=OpenApiTypes.STR,
                enum=Payment.Method.values,
                required=False,
            ),
            OpenApiParameter(name="employee", type=OpenApiTypes.INT, required=False),
        ],
        responses=DashboardResponseSerializer,
    )
    def get(self, request):
        report_filters = ("start_date", "end_date", "product", "payment_method", "employee")
        if (
            any(name in request.query_params for name in report_filters)
            and "reports" not in request.user.effective_business_permissions
        ):
            raise PermissionDenied("Your account is not permitted to filter business reports.")
        period, start_date, start_at, end_at = _dashboard_dates(request)
        location = _requested_location(request.user, request)
        product_id = _report_filter_id(request, "product", CakeProduct.objects.all())
        employee_queryset = User.objects.filter(is_active=True)
        if location is not None:
            employee_queryset = employee_queryset.filter(location=location)
        employee_id = _report_filter_id(request, "employee", employee_queryset)
        payment_method = request.query_params.get("payment_method")
        if payment_method and payment_method not in Payment.Method.values:
            raise ValidationError({"payment_method": "Choose cash, Telebirr, or bank transfer."})

        sales = Sale.objects.filter(
            sold_at__gte=start_at,
            sold_at__lt=end_at,
            status=Sale.Status.ACTIVE,
        )
        payments = Payment.objects.filter(payment_date__gte=start_date, payment_date__lt=end_at.date())
        refunds = SaleRefund.objects.filter(refund_date__gte=start_date, refund_date__lt=end_at.date())
        orders = CustomerOrder.objects.all()
        production = ProductionBatch.objects.filter(produced_at__gte=start_at, produced_at__lt=end_at)
        purchases = IngredientPurchase.objects.filter(
            purchased_at__gte=start_at,
            purchased_at__lt=end_at,
            status=IngredientPurchase.Status.APPROVED,
        )
        pending_purchases = IngredientPurchase.objects.filter(status=IngredientPurchase.Status.PENDING)
        ingredient_balances = IngredientBalance.objects.select_related("ingredient", "location")
        movement_queryset = StockMovement.objects.select_related("location", "ingredient", "product", "actor")
        if location is not None:
            sales = sales.filter(location=location)
            payments = payments.filter(sale__location=location)
            refunds = refunds.filter(sale__location=location)
            orders = orders.filter(location=location)
            production = production.filter(location=location)
            purchases = purchases.filter(location=location)
            pending_purchases = pending_purchases.filter(location=location)
            ingredient_balances = ingredient_balances.filter(location=location)
            movement_queryset = movement_queryset.filter(location=location)

        if product_id is not None:
            sales = sales.filter(lines__product_id=product_id).distinct()
            payments = payments.filter(sale__lines__product_id=product_id).distinct()
            refunds = refunds.filter(sale__lines__product_id=product_id).distinct()
            production = production.filter(product_id=product_id)
        if employee_id is not None:
            sales = sales.filter(cashier_id=employee_id)
            payments = payments.filter(received_by_id=employee_id)
            refunds = refunds.filter(refunded_by_id=employee_id)
            orders = orders.filter(created_by_id=employee_id)
            production = production.filter(recorded_by_id=employee_id)
            purchases = purchases.filter(recorded_by_id=employee_id)
            pending_purchases = pending_purchases.filter(recorded_by_id=employee_id)
            movement_queryset = movement_queryset.filter(actor_id=employee_id)
        if payment_method:
            payments = payments.filter(method=payment_method)
            refunds = refunds.filter(method=payment_method)

        movements_in_period = movement_queryset.filter(created_at__gte=start_at, created_at__lt=end_at)
        consumption = ProductionConsumption.objects.filter(batch__in=production)

        now = timezone.localtime()
        today_start = timezone.make_aware(datetime.combine(now.date(), time.min))
        tomorrow_start = today_start + timedelta(days=1)
        today_orders = orders.filter(created_at__gte=today_start, created_at__lt=tomorrow_start)
        orders_in_period = orders.filter(created_at__gte=start_at, created_at__lt=end_at)
        active_orders = orders.exclude(
            status__in=[CustomerOrder.Status.COMPLETED, CustomerOrder.Status.CANCELLED],
        )

        sales_total = sales.aggregate(
            total=Sum(F("lines__unit_price") * F("lines__quantity")),
            count=Count("id", distinct=True),
        )
        payment_methods = {
            entry["method"]: entry["total"]
            for entry in payments.values("method").annotate(total=Sum("amount"))
        }
        refund_methods = {
            entry["method"]: entry["total"]
            for entry in refunds.values("method").annotate(total=Sum("amount"))
        }
        bank_totals = {}
        for entry in payments.filter(method=Payment.Method.BANK_TRANSFER).values("bank_name").annotate(
            total=Sum("amount"),
        ):
            bank = entry["bank_name"] or "Unspecified"
            bank_totals.setdefault(bank, {"collected": Decimal("0.00"), "refunded": Decimal("0.00")})
            bank_totals[bank]["collected"] += entry["total"]
        for entry in refunds.filter(method=Payment.Method.BANK_TRANSFER).values("bank_name").annotate(
            total=Sum("amount"),
        ):
            bank = entry["bank_name"] or "Unspecified"
            bank_totals.setdefault(bank, {"collected": Decimal("0.00"), "refunded": Decimal("0.00")})
            bank_totals[bank]["refunded"] += entry["total"]
        bank_transfer_by_bank = [
            {
                "bank_name": bank,
                "collected": values["collected"],
                "refunded": values["refunded"],
                "net": values["collected"] - values["refunded"],
            }
            for bank, values in sorted(bank_totals.items())
        ]
        refunds_total = refunds.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        active_refunds_total = refunds.filter(sale__status=Sale.Status.ACTIVE).aggregate(
            total=Sum("amount"),
        )["total"] or Decimal("0.00")
        sales_value = sales_total["total"] or Decimal("0.00")
        open_orders = active_orders.count()
        active_ingredient_count = Ingredient.objects.filter(is_active=True).count()
        sales_by_cake = [
            {"product": row["lines__product__name"], "quantity": row["quantity"], "sales": row["sales"]}
            for row in sales.values("lines__product__name").annotate(
                quantity=Sum("lines__quantity"),
                sales=Sum(F("lines__unit_price") * F("lines__quantity")),
            ).order_by("-quantity")
        ]
        production_by_cake = [
            {
                "product": row["product__name"],
                "quantity": row["quantity"] or 0,
                "wastage": row["wastage"] or 0,
            }
            for row in production.values("product__name").annotate(
                quantity=Sum("quantity"),
                wastage=Sum("wastage_quantity"),
            ).order_by("-quantity")
        ]
        ingredient_consumption = [
            {
                "ingredient": row["ingredient__name"],
                "quantity": row["quantity"] or Decimal("0"),
                "unit": row["unit"],
            }
            for row in consumption.values("ingredient__name", "unit").annotate(
                quantity=Sum("quantity"),
            ).order_by("ingredient__name")
        ]
        location_ids = [location.pk] if location else list(
            Location.objects.filter(is_active=True).values_list("id", flat=True),
        )
        location_stock = []
        for branch in Location.objects.filter(pk__in=location_ids).order_by("name"):
            finished_stock = ProductBalance.objects.filter(location=branch)
            if product_id is not None:
                finished_stock = finished_stock.filter(product_id=product_id)
            location_stock.append({
                "id": branch.pk,
                "name": branch.name,
                "finishedCakes": finished_stock.aggregate(total=Sum("quantity"))["total"] or Decimal("0"),
                "lowIngredients": active_ingredient_count - IngredientBalance.objects.filter(
                    location=branch,
                    ingredient__is_active=True,
                    quantity__gt=F("ingredient__reorder_level"),
                ).count(),
            })
        pending_transfers = StockTransfer.objects.filter(
            status__in=[
                StockTransfer.Status.IN_TRANSIT,
                StockTransfer.Status.PARTIALLY_RECEIVED,
            ],
        )
        if location:
            pending_transfers = pending_transfers.filter(
                Q(source_location=location) | Q(destination_location=location),
            )
        if employee_id is not None:
            pending_transfers = pending_transfers.filter(
                Q(recorded_by_id=employee_id) | Q(received_by_id=employee_id),
            )
        recent_activity = AuditEvent.objects.select_related("location", "actor")
        if location:
            recent_activity = recent_activity.filter(location=location)
        recent_activity = recent_activity.filter(created_at__gte=start_at, created_at__lt=end_at)
        if employee_id is not None:
            recent_activity = recent_activity.filter(actor_id=employee_id)
        if product_id is not None:
            product_movement_ids = movements_in_period.filter(
                product_id=product_id,
            ).values_list("id", flat=True)
            recent_activity = recent_activity.filter(
                Q(target_type="stock_movement", target_id__in=product_movement_ids)
                | Q(target_type="sale", target_id__in=sales.values_list("id", flat=True))
                | Q(target_type="production_batch", target_id__in=production.values_list("id", flat=True))
            )
        response_data = {
            "period": period,
            "startDate": start_date.isoformat(),
            "endDate": (end_at.date() - timedelta(days=1)).isoformat(),
            "location": LocationSerializer(location).data if location else None,
            "summary": {
                "salesTotal": sales_value,
                "netSalesTotal": sales_value - active_refunds_total,
                "refundsTotal": refunds_total,
                "saleCount": sales_total["count"] or 0,
                "cakesSold": sales_by_cake and sum(item["quantity"] or 0 for item in sales_by_cake) or 0,
                "salesByCake": sales_by_cake,
                "productionQuantity": production.aggregate(total=Sum("quantity"))["total"] or 0,
                "productionWastage": production.aggregate(total=Sum("wastage_quantity"))["total"] or 0,
                "productionByCake": production_by_cake,
                "ingredientConsumption": ingredient_consumption,
                "openOrders": open_orders,
                "ordersCreated": orders_in_period.count(),
                "newOrdersToday": today_orders.filter(status=CustomerOrder.Status.NEW).count(),
                "ordersDueToday": active_orders.filter(
                    requested_for__gte=today_start,
                    requested_for__lt=tomorrow_start,
                ).count(),
                "overdueOrders": active_orders.filter(requested_for__lt=today_start).count(),
                "productionBatches": production.count(),
                "ingredientPurchases": purchases.count(),
                "purchaseSpend": sum(
                    (purchase.total_cost for purchase in purchases.prefetch_related("lines")),
                    Decimal("0.00"),
                ),
                "grossMargin": (sales_value - refunds_total) - sum(
                    (purchase.total_cost for purchase in purchases.prefetch_related("lines")),
                    Decimal("0.00"),
                ),
                "grossMarginPercent": (
                    round((((sales_value - refunds_total) - sum(
                        (purchase.total_cost for purchase in purchases.prefetch_related("lines")),
                        Decimal("0.00"),
                    )) / (sales_value - refunds_total)) * Decimal("100"), 1)
                    if (sales_value - refunds_total) > 0
                    else Decimal("0.0")
                ),
                "purchasesPendingApproval": pending_purchases.count(),
                "lowIngredientBalances": (
                    active_ingredient_count * len(location_ids)
                    - ingredient_balances.filter(
                        quantity__gt=F("ingredient__reorder_level"),
                        ingredient__is_active=True,
                    ).count()
                ),
                "pendingTransfers": pending_transfers.count(),
                "cashCollected": payment_methods.get(Payment.Method.CASH, Decimal("0.00")),
                "telebirrCollected": payment_methods.get(Payment.Method.TELEBIRR, Decimal("0.00")),
                "bankTransferCollected": payment_methods.get(Payment.Method.BANK_TRANSFER, Decimal("0.00")),
                "cashRefunded": refund_methods.get(Payment.Method.CASH, Decimal("0.00")),
                "telebirrRefunded": refund_methods.get(Payment.Method.TELEBIRR, Decimal("0.00")),
                "bankTransferRefunded": refund_methods.get(Payment.Method.BANK_TRANSFER, Decimal("0.00")),
                "bankTransferByBank": bank_transfer_by_bank,
                "netPayments": (
                    sum(payment_methods.values(), Decimal("0.00"))
                    - sum(refund_methods.values(), Decimal("0.00"))
                ),
            },
            "locationStock": location_stock,
        }
        if "inventory" in request.user.effective_business_permissions:
            response_data["recentStockMovements"] = StockMovementSerializer(
                movements_in_period[:10],
                many=True,
            ).data
        if "audit" in request.user.effective_business_permissions:
            response_data["recentActivity"] = AuditEventSerializer(
                recent_activity[:10],
                many=True,
            ).data
        if "reports" not in request.user.effective_business_permissions:
            for key in (
                "salesTotal",
                "netSalesTotal",
                "refundsTotal",
                "saleCount",
                "salesByCake",
                "purchaseSpend",
                "grossMargin",
                "grossMarginPercent",
                "cashCollected",
                "telebirrCollected",
                "bankTransferCollected",
                "cashRefunded",
                "telebirrRefunded",
                "bankTransferRefunded",
                "bankTransferByBank",
                "netPayments",
            ):
                response_data["summary"].pop(key, None)
        return Response(response_data)
