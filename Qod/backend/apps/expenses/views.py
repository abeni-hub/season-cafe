from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.serializers import expense_dict
from .models import Expense
from .serializers import ExpenseCreateSerializer
from .services import record_expense


class ExpenseListCreateView(RoleAPIView):
    authorization = ["expenses.manage", "finance.view"]

    def get(self, request):
        queryset = Expense.objects.all()
        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        location = request.query_params.get("location")
        if location:
            queryset = queryset.filter(location=location)
        return self.paginate(request, queryset.order_by("-incurred_at", "-created_at"), expense_dict)


class ExpenseCreateView(RoleAPIView):
    authorization = "expenses.manage"

    def post(self, request):
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        expense = record_expense(
            category=data["category"],
            amount_cents=data["amountCents"],
            location=data["location"],
            note=data["note"],
            incurred_at=data["incurredAt"],
            actor=request.user,
        )
        return Response(expense_dict(expense), status=201)
