from django.urls import path

from .views import (
    MessageListCreateView,
    MessageReadView,
    PublicSiteView,
    SettingsView,
    SiteContentView,
)

urlpatterns = [
    path("site/", PublicSiteView.as_view(), name="site-public"),
    path("site/content/", SiteContentView.as_view(), name="site-content"),
    path("site/settings/", SettingsView.as_view(), name="site-settings"),
    path("messages/", MessageListCreateView.as_view(), name="message-list"),
    path("messages/<uuid:message_id>/read/", MessageReadView.as_view(), name="message-read"),
]
