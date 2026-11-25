from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.serializers import activity_dict, order_dict, supplier_dict
from apps.purchasing.services import supplier_balances
from .services import (
    customer_balances,
    dashboard_summary,
    expenses_by_category,
    inventory_valuation,
    product_performance,
    sales_series,
    total_expenses,
)


def _days(request, default=30) -> int:
    try:
        return int(request.query_params.get("days", default))
    except (TypeError, ValueError):
        return default


class DashboardView(RoleAPIView):
    authorization = "dashboard.view"

    def get(self, request):
        summary = dashboard_summary()
        return Response(
            {
                **{key: value for key, value in summary.items() if key not in {"recentOrders", "recentActivity"}},
                "recentOrders": [order_dict(order) for order in summary["recentOrders"]],
                "recentActivity": [
                    activity_dict(activity) for activity in summary["recentActivity"]
                ],
            }
        )


class SalesReportView(RoleAPIView):
    authorization = ["reports.view", "finance.view"]

    def get(self, request):
        return Response(sales_series(_days(request)))


class ProductReportView(RoleAPIView):
    authorization = ["reports.view", "finance.view"]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 7))
        except (TypeError, ValueError):
            limit = 7
        return Response(product_performance(_days(request), max(1, min(limit, 50))))


class ExpenseReportView(RoleAPIView):
    authorization = ["reports.view", "finance.view"]

    def get(self, request):
        days = _days(request)
        return Response(
            {"byCategory": expenses_by_category(days), "totalCents": total_expenses(days)}
        )


class ValuationReportView(RoleAPIView):
    authorization = ["reports.view", "finance.view", "inventory.view"]

    def get(self, request):
        return Response(inventory_valuation())


class CustomerBalanceReportView(RoleAPIView):
    authorization = ["reports.view", "finance.view", "payments.view"]

    def get(self, request):
        return Response(customer_balances())


class SupplierBalanceReportView(RoleAPIView):
    authorization = "purchasing.manage"

    def get(self, request):
        rows = sorted(
            supplier_balances(), key=lambda row: row["balanceCents"], reverse=True
        )
        return Response(
            [
                {
                    "supplier": supplier_dict(row["supplier"]),
                    "supplierId": row["supplierId"],
                    "name": row["name"],
                    "receivedCents": row["receivedCents"],
                    "paidCents": row["paidCents"],
                    "balanceCents": row["balanceCents"],
                }
                for row in rows
            ]
        )
