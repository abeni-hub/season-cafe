# cPanel shared-hosting deployment (Django + PostgreSQL + Passenger)

This guide deploys the `backend/` Django application to a cPanel account that offers
**PostgreSQL** and **Setup Python App / Passenger**. It does not require root access,
Docker, systemd, Redis or Celery, and it never uses `manage.py runserver` in
production.

> The actual hosting account was not accessible while this project was built. Run
> `deploy/CHECKLIST.md` first and record the real versions and paths. Where your host
> differs (Python version, DB host/port, Passenger layout), change the paths below.

---

## 1. Architecture on the host

```
/home/CPANEL_USER/
  apps/seasons-cake/
    frontend-dist/            <- built React files (public_html or subdomain docroot)
    backend/                  <- cPanel Python application root
      manage.py
      passenger_wsgi.py       <- Passenger entry point
      config/settings_prod.py
      .env                    <- secrets, readable only by the account
      staticfiles/            <- collectstatic output (served by WhiteNoise)
      media/                  <- optional, not publicly served by default
  logs/
```

- `backend/` must **not** be inside `public_html`.
- Put the built frontend in a separate directory or subdomain document root.
- The API can live at `https://api.example.com` with the application URL set to it.
- Database: create it in cPanel → PostgreSQL Databases. PostgreSQL only; the project
  refuses to start unless a PostgreSQL database is configured.

---

## 2. Prerequisites in cPanel

1. **PostgreSQL Databases**: create database, user, strong password, grant ALL.
2. **Setup Python App**: create an application
   - Application root: `apps/seasons-cake/backend`
   - Application URL: your API host/subdomain
   - Application startup file: `passenger_wsgi.py`
   - Python version: 3.11 or newer (project verified on 3.13.15)
3. **SSL/TLS**: AutoSSL or Let's Encrypt certificate active for the API host.
4. **Terminal/SSH** (optional but recommended) or use cPanel's "Run Pip Install"
   and command buttons.

---

## 3. Environment variables

Set these in cPanel → Setup Python App → Environment variables **or** in
`backend/.env` (copy from `.env.example`). `.env` must remain outside
`public_html` and be chmod 600.

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DJANGO_SETTINGS_MODULE` | yes | `config.settings_prod` | Set by `passenger_wsgi.py`; keep it if cPanel asks |
| `DJANGO_SECRET_KEY` | yes | 64+ random chars | Generate: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `DJANGO_ALLOWED_HOSTS` | yes | `api.example.com` | Comma separated; no scheme |
| `DATABASE_URL` | yes* | `postgres://user:pass@localhost:5432/dbname` | *or* the `DB_*` variables below |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | yes* | `cpuser_seasons` / `cpuser_bakery` / secret / `localhost` / `5432` | Used when `DATABASE_URL` is empty |
| `CORS_ALLOWED_ORIGINS` | yes | `https://seasonscake.example.com` | Exact frontend origin(s), no trailing slash |
| `CSRF_TRUSTED_ORIGINS` | recommended | `https://api.example.com` | Defaults to CORS origins if empty |
| `APP_ENV` | no | `production` | Shown by `/health/` |
| `DJANGO_SECURE_SSL_REDIRECT` | no | `true` | Keep true with a valid certificate |
| `DJANGO_HSTS_SECONDS` | no | `31536000` | Set `0` while validating HTTPS |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | no | `30` / `7` | Token lifetimes |
| `THROTTLE_LOGIN` | no | `10/min` | Login throttle per IP+email |
| `THROTTLE_PUBLIC_WRITE` | no | `20/hour` | Public enquiry/message throttle |
| `LOG_LEVEL` | no | `INFO` | Console/stderr, captured by Passenger |
| `SEED_PASSWORD` | only for demo | strong password | Used by `manage.py seed`; never commit |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | only for first admin | `owner@example.com` / Owner / strong | Used by `create_admin` |

No secret is committed in the repository. `settings_prod.py` fails fast if the
secret key, database or allowed hosts are missing/default.

---

## 4. Install and first deploy

Run these in the cPanel Terminal (activate the app's virtualenv first; cPanel shows
the exact `source` command):

```bash
cd ~/apps/seasons-cake/backend
python -m pip install --upgrade pip
pip install -r requirements.txt

# Environment
cp .env.example .env
nano .env                      # fill in real values, chmod 600 .env

# Static assets for the admin/DRF pages
python manage.py collectstatic --noinput

# Schema
python manage.py migrate --noinput

# First owner account (choose one)
python manage.py create_admin --email owner@example.com --name "Owner"
#   or set ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD and run: python manage.py create_admin

# Optional demo catalogue/ledgers (never on real business data unless intended)
# SEED_PASSWORD='...' python manage.py seed
```

From cPanel's "Setup Python App" screen, restart the application after any code or
environment change. Passenger will load `passenger_wsgi.py` →
`config.settings_prod` → `config.wsgi.application`.

If shell access is unavailable, use the Python App UI to run pip and manage commands
(each app panel exposes a "Run command" box on most hosts), or temporarily add a
one-off management command and remove it afterwards.

---

## 5. Static and media files

- **Static**: `STATIC_ROOT=backend/staticfiles`, served by WhiteNoise through the
  Passenger WSGI app at `/static/`. `collectstatic` must be re-run after upgrades.
  WhiteNoise never serves secrets because `staticfiles/` contains only collected
  static assets.
- **Media**: `MEDIA_ROOT=backend/media` is configured for future uploads, but this
  project's APIs do not expose public uploads. WhiteNoise does not serve media in
  production. If uploads are added later:
  1. Keep `media/` outside `public_html`; or
  2. Serve it through a protected Django view; or
  3. Ask the host to map a subdomain document root to a dedicated media folder.
  Never serve `backend/` or `.env` directly.

---

## 6. Database migrations and rollback

```bash
python manage.py showmigrations
python manage.py migrate --plan
python manage.py migrate --noinput
```

- Take a cPanel/PostgreSQL backup before each deploy (`pg_dump` if available).
- Rolling back application code does not roll back schema. Restore the database dump
  or write a reverse migration before downgrading.
- Never edit applied migration files; create a new migration.

---

## 7. Cron jobs

See `deploy/CRON.md`. One daily `clearsessions` job is sufficient; the platform does
not require Celery/Redis. Stock, payments and production are transactional and run
inside web requests.

---

## 8. Domain, CORS, CSRF and HTTPS

1. Point the API subdomain at the cPanel application URL.
2. Set `DJANGO_ALLOWED_HOSTS=api.example.com` (comma-separated if more).
3. Set `CORS_ALLOWED_ORIGINS=https://seasonscake.example.com` (the React site).
   Never use `*` with credentials; the API does not use cookie auth for the SPA.
4. Set `CSRF_TRUSTED_ORIGINS=https://api.example.com` for `/admin/`.
5. Enable AutoSSL and confirm `https://api.example.com/health/` returns
   `{"status":"ok","database":"ok"}`.
6. `SECURE_SSL_REDIRECT`, secure cookies and HSTS are enabled by
   `settings_prod.py`. If redirects loop, the proxy is not forwarding
   `X-Forwarded-Proto`; fix the host header rather than disabling HTTPS.

---

## 9. Health check and smoke tests

```bash
curl https://api.example.com/health/
curl https://api.example.com/api/v1/products/
curl -I https://api.example.com/api/docs/
```

- `/health/` runs `SELECT 1`; a 503 means the DB is unreachable.
- `/api/docs/` is the OpenAPI UI; `/api/schema/` is the schema.
- Sign in through the frontend and confirm the dashboard loads; then create a POS
  sale and verify stock in **Inventory → Stock**.

---

## 10. Logging and monitoring

`LOGGING` writes to stderr; Passenger captures it in the app log shown by cPanel
(commonly `~/logs/<app>.log`). Use cPanel → Errors for Apache/Passenger startup
failures. Key checks:

```bash
tail -f ~/logs/*.log
```

A 500 on every request usually means: wrong Python version, missing package, bad
`.env`, or the DB host/port. Run `python manage.py check --deploy` in the app
virtualenv to see configuration warnings.

---

## 11. Updating the application

```bash
cd ~/apps/seasons-cake/backend
# upload/replace code (do not overwrite .env)
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# restart the Python app from cPanel
```

Then hard-refresh the frontend and re-check `/health/`.

---

## 12. Security notes

- Backend authorization is authoritative; the frontend's hidden routes are not a
  security boundary. Roles are enforced in `apps/accounts/permissions.py`.
- Passwords use Django's PBKDF2 hasher; JWT refresh tokens rotate and are blacklisted
  on logout.
- Login and public write endpoints are throttled; raise limits only with evidence.
- `.env`, `backend/`, database dumps and logs stay outside `public_html`.
- Customer/employee data is only returned to roles with the matching permission;
  `/api/v1/bootstrap/` filters payloads server-side.
- Validate uploads if upload endpoints are added: use Pillow for images, size limits
  (`FILE_UPLOAD_MAX_MEMORY_SIZE`) and serve media outside the code tree.
