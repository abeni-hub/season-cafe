"""Production settings for cPanel/Passenger deployments.

Import via DJANGO_SETTINGS_MODULE=config.settings_prod. The module fails fast when
required secrets or the database URL are missing so a misconfigured deploy cannot
silently boot with development defaults.
"""

import os

from .settings import *  # noqa: F401,F403

DEBUG = False

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "dev-only-insecure-secret-key-change-me-before-deploying":
    raise RuntimeError("DJANGO_SECRET_KEY must be set to a strong unique value in production.")

if not (os.environ.get("DATABASE_URL") or os.environ.get("DB_NAME")):
    raise RuntimeError("Configure DATABASE_URL (or DB_NAME/DB_USER/DB_HOST) for production PostgreSQL.")

if not ALLOWED_HOSTS or ALLOWED_HOSTS == ["localhost", "127.0.0.1", "[::1]"]:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS must list the production hostnames.")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "true").lower() in {"1", "true", "yes"}
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

if not CORS_ALLOWED_ORIGINS:
    raise RuntimeError("CORS_ALLOWED_ORIGINS must list the deployed frontend origin(s).")

CSRF_TRUSTED_ORIGINS = CSRF_TRUSTED_ORIGINS or CORS_ALLOWED_ORIGINS
