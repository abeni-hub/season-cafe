import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "season_api.settings")

app = Celery("season_api")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
app.conf.beat_schedule = {
    "daily-low-stock-scan": {
        "task": "seasonops.tasks.report_low_stock",
        "schedule": crontab(hour=8, minute=0),
    },
}
