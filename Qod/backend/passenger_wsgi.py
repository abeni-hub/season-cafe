"""Passenger entry point for cPanel shared hosting.

Set the cPanel application root to this ``backend`` directory. Passenger reads the
``application`` object below; never run ``manage.py runserver`` in production.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_prod")

from config.wsgi import application  # noqa: E402,F401
