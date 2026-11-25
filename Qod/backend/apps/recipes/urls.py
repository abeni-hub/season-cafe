from django.urls import path

from .views import RecipeListCreateView, RecipeUpsertView

urlpatterns = [
    path("recipes/", RecipeListCreateView.as_view(), name="recipe-list"),
    path("recipes/upsert/", RecipeUpsertView.as_view(), name="recipe-upsert"),
]
