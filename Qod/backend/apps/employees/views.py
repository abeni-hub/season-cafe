from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.serializers import EmployeeCreateSerializer, EmployeeUpdateSerializer
from apps.core.api import RoleAPIView
from apps.core.errors import DomainError
from apps.core.serializers import employee_dict
from apps.employees.services import create_employee, update_employee


class EmployeeListCreateView(RoleAPIView):
    authorization = "employees.manage"

    def get(self, request):
        return self.paginate(request, User.objects.order_by("name"), employee_dict)

    def post(self, request):
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        employee = create_employee(
            name=data["name"],
            email=data["email"],
            password=data["password"],
            role=data["role"],
            actor=request.user,
        )
        return Response(employee_dict(employee), status=201)


class EmployeeDetailView(RoleAPIView):
    authorization = "employees.manage"

    def get(self, request, employee_id):
        employee = User.objects.filter(pk=employee_id).first()
        if employee is None:
            raise DomainError("Employee not found.")
        return Response(employee_dict(employee))

    def patch(self, request, employee_id):
        serializer = EmployeeUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        employee = update_employee(
            employee_id=employee_id,
            actor=request.user,
            name=data.get("name"),
            role=data.get("role"),
            is_active=data.get("isActive"),
        )
        return Response(employee_dict(employee))
