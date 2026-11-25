from rest_framework.response import Response

from apps.core.api import RoleAPIView
from apps.core.serializers import recipe_dict
from .models import Recipe
from .serializers import RecipeUpsertSerializer
from .services import upsert_recipe


class RecipeListCreateView(RoleAPIView):
    authorization = ["recipes.manage", "production.view"]

    def get(self, request):
        queryset = Recipe.objects.prefetch_related("lines").select_related("product")
        product = request.query_params.get("product")
        if product:
            queryset = queryset.filter(product_id=product)
        return self.paginate(request, queryset, recipe_dict)


class RecipeUpsertView(RoleAPIView):
    authorization = "recipes.manage"

    def post(self, request):
        serializer = RecipeUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        recipe = upsert_recipe(
            product_id=data["productId"],
            yield_quantity=data["yieldQuantity"],
            lines=data["lines"],
            notes=data.get("notes", ""),
            actor=request.user,
        )
        return Response(recipe_dict(recipe), status=201)
