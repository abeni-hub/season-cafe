from rest_framework import serializers

from seasonops.models import User
from seasonops.serializers import AuditEventSerializer, LocationSerializer, StockMovementSerializer


class ReportEmployeeSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    location_name = serializers.CharField(source="location.name", read_only=True, default="")

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "role", "workspace", "location", "location_name"]

    def get_display_name(self, user) -> str:
        return user.get_full_name() or user.get_username()


class StaffUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    location_name = serializers.CharField(source="location.name", read_only=True, default="")
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "display_name",
            "role",
            "workspace",
            "location",
            "location_name",
            "is_active",
            "password",
            "date_joined",
        ]
        read_only_fields = ["id", "display_name", "location_name", "date_joined"]

    def get_display_name(self, user) -> str:
        return user.get_full_name() or user.get_username()

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User.objects.create_user(**validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class SalesByCakeSerializer(serializers.Serializer):
    product = serializers.CharField()
    quantity = serializers.IntegerField()
    sales = serializers.DecimalField(max_digits=14, decimal_places=2)


class ProductionByCakeSerializer(serializers.Serializer):
    product = serializers.CharField()
    quantity = serializers.IntegerField()
    wastage = serializers.IntegerField()


class IngredientConsumptionSerializer(serializers.Serializer):
    ingredient = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3)
    unit = serializers.CharField()


class BankTransferByBankSerializer(serializers.Serializer):
    bank_name = serializers.CharField()
    collected = serializers.DecimalField(max_digits=14, decimal_places=2)
    refunded = serializers.DecimalField(max_digits=14, decimal_places=2)
    net = serializers.DecimalField(max_digits=14, decimal_places=2)


class DashboardSummarySerializer(serializers.Serializer):
    salesTotal = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    netSalesTotal = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    refundsTotal = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    saleCount = serializers.IntegerField(required=False)
    cakesSold = serializers.IntegerField(required=False)
    salesByCake = SalesByCakeSerializer(many=True, required=False)
    productionQuantity = serializers.IntegerField(required=False)
    productionWastage = serializers.IntegerField(required=False)
    productionByCake = ProductionByCakeSerializer(many=True, required=False)
    ingredientConsumption = IngredientConsumptionSerializer(many=True, required=False)
    ordersCreated = serializers.IntegerField(required=False)
    openOrders = serializers.IntegerField()
    newOrdersToday = serializers.IntegerField()
    ordersDueToday = serializers.IntegerField()
    overdueOrders = serializers.IntegerField()
    productionBatches = serializers.IntegerField()
    ingredientPurchases = serializers.IntegerField()
    purchaseSpend = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    grossMargin = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    grossMarginPercent = serializers.DecimalField(max_digits=5, decimal_places=1, required=False)
    purchasesPendingApproval = serializers.IntegerField()
    lowIngredientBalances = serializers.IntegerField()
    pendingTransfers = serializers.IntegerField()
    cashCollected = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    telebirrCollected = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    bankTransferCollected = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    cashRefunded = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    telebirrRefunded = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    bankTransferRefunded = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    bankTransferByBank = BankTransferByBankSerializer(many=True, required=False)
    netPayments = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)


class DashboardLocationStockSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    finishedCakes = serializers.DecimalField(max_digits=14, decimal_places=3)
    lowIngredients = serializers.IntegerField()


class DashboardResponseSerializer(serializers.Serializer):
    period = serializers.CharField()
    startDate = serializers.DateField()
    endDate = serializers.DateField()
    location = LocationSerializer(allow_null=True)
    summary = DashboardSummarySerializer()
    locationStock = DashboardLocationStockSerializer(many=True)
    recentStockMovements = StockMovementSerializer(many=True, required=False)
    recentActivity = AuditEventSerializer(many=True, required=False)
