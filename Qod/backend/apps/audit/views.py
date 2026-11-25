from apps.audit.models import Activity
from apps.core.api import RoleAPIView
from apps.core.serializers import activity_dict


class ActivityListView(RoleAPIView):
    authorization = ["dashboard.view", "reports.view"]

    def get(self, request):
        return self.paginate(request, Activity.objects.order_by("-created_at"), activity_dict)
