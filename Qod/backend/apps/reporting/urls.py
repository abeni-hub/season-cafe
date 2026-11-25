from django.urls import path

from .views import (
    CustomerBalanceReportView,
    DashboardView,
    ExpenseReportView,
    ProductReportView,
    SalesReportView,
    SupplierBalanceReportView,
    ValuationReportView,
)

urlpatterns = [
    path("reports/dashboard/", DashboardView.as_view(), name="report-dashboard"),
    path("reports/sales/", SalesReportView.as_view(), name="report-sales"),
    path("reports/products/", ProductReportView.as_view(), name="report-products"),
    path("reports/expenses/", ExpenseReportView.as_view(), name="report-expenses"),
    path("reports/valuation/", ValuationReportView.as_view(), name="report-valuation"),
    path("reports/customer-balances/", CustomerBalanceReportView.as_view(), name="report-customer-balances"),
    path("reports/supplier-balances/", SupplierBalanceReportView.as_view(), name="report-supplier-balances"),
]
