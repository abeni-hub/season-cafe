# Hosting environment verification

This deployment could not be tested against the real cPanel account from this
workspace. Verify each item in the hosting control panel before going live. Nothing
here assumes root access, Docker, systemd, Redis or Celery.

| # | Item | How to verify | Consequence if unsupported |
|---|------|---------------|----------------------------|
| 1 | PostgreSQL database and user | cPanel → PostgreSQL Databases; create DB + user, grant ALL | Django cannot run; do not substitute SQLite/MySQL |
| 2 | Database host/port | cPanel shows the DB host; often `localhost`, port 5432 | Set `DB_HOST`/`DB_PORT` accordingly |
| 3 | Python version | Setup Python App → Python version; project targets 3.11+ (built with 3.13.15) | Pin a supported Python or ask the host |
| 4 | Passenger / WSGI support | Setup Python App is available in cPanel | Without Passenger, use a VPS; do not use runserver |
| 5 | Shell/Terminal access | cPanel → Terminal (or SSH) | You must run pip/migrate through the Python App UI instead |
| 6 | Outbound pip access | `pip install -r requirements.txt` succeeds | Vendor wheels locally and upload them |
| 7 | Persistent disk | Files outside `public_html` survive restarts | `media/` uploads could be lost; back up regularly |
| 8 | Cron jobs | cPanel → Cron Jobs is present | Session cleanup must be run manually |
| 9 | SSL certificate | AutoSSL / Let's Encrypt active for API host | Secure cookies and HSTS will break plain HTTP |
| 10 | Reverse-proxy headers | Apache/LiteSpeed forwards `X-Forwarded-Proto` | Check `SECURE_SSL_REDIRECT`; adjust if redirect loops |
| 11 | Log location | Passenger/app logs path shown (often `~/logs`) | Use cPanel error logs for 500s |
| 12 | DB backup | cPanel backup or Scheduled Tasks | Take a `pg_dump` before migrations/seed |

Record the observed values here when verified:

- PostgreSQL version: __________
- Python version: __________
- App root: __________
- Application URL: __________
- Static URL prefix: `/static/`
- Log path: __________
