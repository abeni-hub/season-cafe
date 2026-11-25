from django.urls import path

from .views import ExpenseCreateView, ExpenseListCreateView

urlpatterns = [
    path("expenses/", ExpenseListCreateView.as_view(), name="expense-list"),
    path("expenses/create/", ExpenseCreateView.as_view(), name="expense-create"),
]
