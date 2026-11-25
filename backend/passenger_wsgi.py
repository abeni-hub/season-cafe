import os
import sys

# Phusion Passenger WSGI entry point for cPanel shared hosting
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "season_api.settings")

from season_api.wsgi import application
