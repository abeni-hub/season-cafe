from django.urls import path

from .views import BatchCreateView, BatchDetailView, BatchListCreateView, BatchTransitionView

urlpatterns = [
    path("batches/", BatchListCreateView.as_view(), name="batch-list"),
    path("batches/create/", BatchCreateView.as_view(), name="batch-create"),
    path("batches/<uuid:batch_id>/", BatchDetailView.as_view(), name="batch-detail"),
    path("batches/<uuid:batch_id>/transition/", BatchTransitionView.as_view(), name="batch-transition"),
]
