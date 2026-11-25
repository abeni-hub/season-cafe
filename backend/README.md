# Season Cake business management system

The BMS runs separately from the public Vite site. It consists of a Django
REST API in this folder and a React portal in `../bms-frontend`.

The portal has owner, manager, and employee workspaces in one React
application. Django enforces each capability and location boundary on the
server. Managers can be assigned a custom feature list; employees default to
the production or café workspace. Browser authentication uses Django sessions
with HttpOnly session cookies and CSRF protection; no long-lived token is
stored in browser storage.

The backend is a modular monolith. `accounts` owns session-authentication
endpoints, `reporting` owns owner-report APIs and serializers, and `seasonops`
owns the shared operational models and transactional workflows. These apps
run in one Django process and share one PostgreSQL database; they are not
separately deployed services.

## Local development

Install the Python dependencies with `python -m pip install -r requirements.txt`.
Run commands from this folder:

```powershell
python -m pytest -q
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py runserver 127.0.0.1:8000
```

In another terminal, run the portal:

```powershell
Set-Location ..\bms-frontend
npm install
npm run dev
```

The portal proxies `/api`, `/admin`, and `/media` to Django. The public website
proxies `/api/v1/public/`, `/media`, and `/orders` to the same API while running
its Vite development server.

## Docker development environment

From the project root, `docker compose up --build` starts PostgreSQL, Redis,
the Django API (Gunicorn), a Celery worker, the daily-backup service, both Vite
development frontends, and an HTTP Nginx reverse proxy. Visit
`http://localhost:8080` for the public site and `http://bms.localhost:8080`
for the staff portal. The Compose database
password and Django key defaults are development-only; override them for any
shared environment. This Compose stack does not apply migrations on startup.
After reviewing the migration files, apply them only to the intended database
with `docker compose exec api python manage.py migrate`.

### Test production-built frontend assets locally

Use the preview override and a unique Compose project name to keep this
disposable test database separate from other Compose data:

```powershell
docker compose -p season-cake-local -f compose.yaml -f compose.preview.yaml up --build -d api
docker compose -p season-cake-local -f compose.yaml -f compose.preview.yaml exec api python manage.py migrate
docker compose -p season-cake-local -f compose.yaml -f compose.preview.yaml exec api python manage.py createsuperuser
```

The override publishes the API only on `127.0.0.1:8000`. Build and preview
each frontend in a separate terminal; Vite Preview serves the compiled assets
and proxies API requests to that local API:

```powershell
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5173
```

```powershell
Set-Location bms-frontend
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174` for the staff portal and
`http://127.0.0.1:5173` for the public website. Stop the test stack with the
same `-p` and `-f` options followed by `down`; omit `-v` to preserve its
database for the next run. Use `down -v` only when you intend to delete this
disposable project's database and other named volumes.

The versioned API is available under `/api/v1/`, with its OpenAPI schema and
Swagger UI at `/api/v1/schema/` and `/api/v1/docs/`. The prior `/api/` routes
remain as a compatibility alias; new portal code should use `/api/v1/`.
Collection endpoints return page-number pagination (`page` and optional
`page_size`, capped at 100) and support endpoint-specific `search`,
`ordering`, and exact filters. The portal's shared API helper follows result
pages and validates that pagination links remain same-origin.

Redis backs the Celery queue and cache. The Celery worker runs queued work, and
Celery Beat performs a daily low-stock scan at 08:00 Addis Ababa time; each
below-threshold balance is emitted to structured application logs. The owner
dashboard and operational lists use modest TanStack Query polling for timely
updates. Django Channels is intentionally omitted: current workflows do not
justify a persistent websocket service. S3-compatible object storage can be
enabled by setting `AWS_STORAGE_BUCKET_NAME` and its region/endpoint variables.
Upload models are not yet part of the business workflow.

The development backup service writes an initial PostgreSQL custom-format
snapshot at startup and repeats every 24 hours, retaining 14 days in the
`season-backups` volume. Override `BACKUP_INTERVAL_SECONDS` or
`BACKUP_RETENTION_DAYS` for local testing. Development snapshots are
unencrypted and must not be copied to an untrusted destination.

## Production HTTPS deployment

The production overlay builds both frontends as static Nginx images and
terminates TLS at the edge Nginx. Prepare an environment file from the
non-secret template, then set the real domains, a strong Django key, a
URL-safe PostgreSQL password, and the HTTPS origins:

```powershell
Copy-Item .env.production.example .env.production
# Edit .env.production; do not commit it.
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml up --build -d
```

`TLS_CERT_DIR` must point outside the repository to a directory containing
`fullchain.pem` and `privkey.pem`. The production proxy redirects HTTP to
HTTPS, sends HTTPS protocol headers to Django, and serves the collected static
files and local media volume. Renew certificates with the chosen certificate
provider and reload Nginx after renewal. The sample config enables HSTS for
the configured hosts only; do not add subdomain or preload directives unless
all affected hosts are HTTPS-only.

Production backups are encrypted with `age` when `BACKUP_AGE_RECIPIENT` is
configured. Generate the recipient and keep its corresponding identity key
offline and separately access-controlled (for example, run `age-keygen` on a
trusted workstation and copy only its public recipient into the production
environment file). The scheduled service retains
encrypted dumps in the `season-backups` volume; regularly copy them off-host
and test restoration. To copy an encrypted dump to the host:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml cp `
  backup:/backups/season-cake-YYYYMMDD-HHMMSS.dump.age backups\
```

Install `age` on the restore workstation and create the target database before
restoring. The restore script decrypts only to a temporary host file, removes
it after the operation, and requires confirmation because it replaces the
target database contents:

```powershell
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml exec db `
  createdb -U season_cake season_cake_restore
.\backend\scripts\restore-postgres.ps1 `
  -BackupFile C:\backups\season-cake-YYYYMMDD-HHMMSS.dump.age `
  -AgeIdentityFile C:\secure\season-cake-backup-identity.txt `
  -TargetDatabase season_cake_restore
```

The default database configuration is local SQLite. `DATABASE_URL` can select
PostgreSQL; production must use PostgreSQL, `DJANGO_DEBUG=false`, a private
`DJANGO_SECRET_KEY`, the correct `DJANGO_ALLOWED_HOSTS`, and HTTPS origins in
`DJANGO_CSRF_TRUSTED_ORIGINS`. Django settings read environment variables from
the process; `.env.example` is a reference, not an automatically loaded file.

## Initial business setup

The schema migration creates the two named operating locations, Home Bakery
and Café / Sales Location. Confirm their names and assign users to the
appropriate location before operations begin. No products, ingredients,
suppliers, recipes, prices, or stock are seeded. The owner manages cake
products and ingredients in the React portal's Catalog section and creates
recipe versions in its Recipes section. Product `web_id` is the stable public
cake ID used when a website order is submitted; keep it unique and use the ID
sent by the public catalog.

## Public website content management

The public Vite site and staff portal use the same Django API and PostgreSQL
database. In the React portal, use **Catalog** to manage cake names,
descriptions, categories, prices, images, featured status, availability, and
whether a product/category is visible publicly. Use **Website content** to
edit business details, homepage copy, banners, flexible content/promotion
sections, gallery photos, and approved testimonials. The editor supports
drafts and preview; publish the website settings only after reviewing the
content. A product or content item must also be individually published to
appear publicly. Unpublishing the main website settings restores the existing
site until the CMS is ready, rather than exposing partial CMS content.

Public image requests are served through Django, which checks that the image
belongs to currently published content. Authorized staff can preview draft
images. Store real business images in the configured media storage and provide
descriptive alt text. Website-content changes and publication actions are
attributed to the staff member in the business audit log.

Messages sent by the public site's contact form are saved as website inquiries.
Authorized users can review them in **Customer inquiries** and update their
status. Public website orders are saved in the shared **Customer orders**
register with their source set to Website; staff-created orders are marked
Staff. Customers are matched by normalized phone number while each order
retains its submitted contact details.

Create the initial owner with Django's `createsuperuser` command. Assign
managers and employees to one active location and set their role using the
staff-account administration tools. Owners can view both locations; staff
accounts can only work in their assigned location. The user admin exposes a
workspace (`bakery` or `cafe`) and manager feature permissions. Defaults give
production staff purchasing/production/ingredient access and café staff
sales/orders/finished-stock access. Owners can replace those defaults with an
explicit feature list; the API independently enforces each permission.
The owner reviews website requests in the Customer orders module and assigns
each request to a location. Unassigned requests are visible to owners only.
Order numbers, status history, source, responsible employee, and payment status
are shown in the shared order register. Payment status is derived from a sale
linked to that order; the order stays in the register through every status.

## Production and transfers

Production is recorded at the Home Bakery. The production requirements endpoint
calculates the current recipe quantity and compares it with available stock
after transfer reservations. Batch confirmation records actual ingredient use
and finished output in one database transaction. If actual ingredient use
differs from the recipe, record an adjustment reason. The entered production
quantity includes documented wastage; only the non-wasted quantity enters
finished stock. A request idempotency key makes a retry return the same batch
instead of consuming ingredients twice.

Finished-cake shipments can contain multiple cake types. Dispatch creates
reservations but does not change confirmed stock at either location. An
authorized destination employee records each receipt, including partial
receipts; received quantities update both locations. A short final receipt
requires a discrepancy reason, which is retained in the receipt history and
stock ledger. Reserved units are unavailable to production, sales, adjustments,
or another dispatch until the shipment is received or closed.

Website and staff order submissions also require idempotency keys. The public
site generates and reuses a key for retries; the portal does the same for
staff orders and multi-item transfer shipments.

## Daily sales and payments

The café sales screen uses the configured catalog price and current available
stock for each cake. A sale can contain multiple cake types and quantities;
repeated product rows are combined into one sale item. The server rechecks
prices and stock inside the transaction, records the cashier and sale time,
and rejects an order that is already linked to another sale. Website orders
do not change stock when submitted; converting one to a sale deducts its cakes
once. Sale requests and follow-up payments carry idempotency keys, so a retry
does not create another sale, payment, or stock movement.

Payments are separate decimal-valued records in ETB, with method, payment date,
recording employee, and server-recorded timestamp. A bank transfer requires
only the bank name; no account or transaction identifiers are requested.
Cash, Telebirr, and bank transfer can be split across multiple payments.
Payment records are not overwritten when money is returned.

Refunds are separate auditable records with method, amount, date, reason, and
employee. A refund may include returned cake quantities; only those quantities
are restored through stock-ledger movements. Cancelling a sale requires a
reason and confirmation that all cakes are returned; it records refunds
against the original payment methods and reverses the sale stock once.
Dashboard and report totals show collections, refunds, net amounts, and bank
transfer totals by bank name.

Ingredients have one configured stock unit. Purchases, recipe lines, and
production consumption accept kg/g, l/ml, and piece with validated conversions;
cross-dimension conversions are rejected. Recipe edits create a new version,
so completed production keeps its original recipe and consumption snapshots.
Production cost is only calculated where purchase-cost data is available.
Purchase approval is optional and disabled by default; when enabled, pending
purchases add to stock only after approval. Purchase submissions require a
unique idempotency key so a retried request cannot receive stock twice.

## Schema and database safety

`seasonops/migrations/0001_initial.py` and later migration files define the
schema; they do not apply themselves. No migration has been applied to a
business database. Review the migrations and obtain approval before running
`python manage.py migrate` against any persistent database. The test suite
uses Django's disposable test database.

Stock receipts, production, sales, transfers, and adjustments update the stock
ledger and balances transactionally. Do not edit ledger entries or balances
directly in the admin. Correct stock through an attributed adjustment instead.
Operational API actions and order changes also create audit events, filtered by
location and permission. React portal catalog edits create business audit
events; Django admin records staff-account edits in its own admin log. These
records are operational history, not tamper-proof compliance storage; restrict
database and administrator access accordingly.

The latest migrations include a baseline status-history entry for each legacy
order, mark legacy transfers as already deducted at dispatch, and backfill
payment dates from recorded payment timestamps. Review and apply these
migrations only to the intended database.

## Public order intake

`POST /orders` (also accepts `/orders/`) accepts the payload used by the public
website. Requests are rate-limited, stored with website as the source, and
left unassigned until an owner selects a location. They do not reserve stock
or confirm availability. The CMS-enabled contact form posts to
`POST /api/v1/public/inquiries/`; submissions are rate-limited, idempotent,
and visible in the React portal's Customer inquiries module. Public site data
is served by `GET /api/v1/public/site/`; authenticated staff with the
`website_content` permission manage it under `/api/v1/website/`.

## Security and operations

The base Compose stack is for development: it uses local-only credential
defaults, HTTP, and `DJANGO_DEBUG=true`. Do not expose it directly to the
internet. Use the production overlay for TLS and set `DJANGO_DEBUG=false`, a private `DJANGO_SECRET_KEY`,
restricted `DJANGO_ALLOWED_HOSTS`, and HTTPS-only CSRF trusted origins. Set
`DJANGO_SECURE_SSL_REDIRECT=true` and a deliberate HSTS duration after HTTPS is
working. Enable HSTS subdomains or preload only when every affected hostname
is permanently HTTPS-only.

Django trusts `X-Forwarded-Proto` from its immediate reverse proxy. The proxy
must overwrite that header from the actual TLS connection rather than pass
through a client-supplied value. Configure TLS termination, certificate
renewal, HTTPS redirects, and secure headers at the production edge. The
development Nginx configuration listens on HTTP only.

The API health endpoints are `/health/live/` and `/health/ready/`; readiness
checks the database connection. Django emits structured JSON application and
request-error logs to stdout/stderr. Do not log request bodies, passwords,
session identifiers, or payment details. Collect logs in an access-controlled,
retention-managed destination and alert on error-level events. No external
error-monitoring provider is configured.

## Backups and validation

For an ad-hoc local snapshot, run `.\backend\scripts\backup-postgres.ps1`; it
writes to `%USERPROFILE%\SeasonCakeBackups` by default. For production, use the
Compose backup service described above, configure an `age` recipient, export
encrypted dumps off-host, and retain the identity key separately. Test restore
regularly against a disposable database; restore replaces objects in the
selected database and requires confirmation. Inspect a restore operation
without applying it:

```powershell
.\backend\scripts\restore-postgres.ps1 -BackupFile C:\backups\season-cake.dump.age -AgeIdentityFile C:\secure\backup-key.txt -TargetDatabase season_cake_restore -WhatIf
```

Run backend tests and checks with `python -m pytest -q`, `python manage.py check`,
`python manage.py makemigrations --check --dry-run`,
and `python manage.py spectacular --validate --file NUL`. Frontend component
tests run with `npm test`; `npm run test:e2e` runs the Playwright login
validation smoke test and needs Chromium installed with
`npx playwright install chromium`. Build the portal with `npm run build`.
The PostgreSQL concurrency tests are skipped on SQLite; set `DATABASE_URL` to
a disposable PostgreSQL test target to run them. Never point test runs at a
persistent business database.

## Phase acceptance criteria

- **16 — Security and permissions:** login requires CSRF; unauthenticated API
  access is denied; staff cannot cross location or service permission
  boundaries; restricted report filters are denied; business actions record
  their actor.
- **17 — Owner reporting:** daily, weekly, monthly, and custom date ranges
  derive totals from database records; product, payment, location, and employee
  filters are enforced; employee activity and stock are location-scoped.
- **18 — Deployment and operations:** the production Compose overlay validates
  with required environment variables; HTTPS redirects to mounted certificates;
  app health checks remain reachable; backups are scheduled, retained, and
  encrypted in production; restore is tested against a disposable database.
- **19 — Testing:** backend API tests pass on SQLite; the same suite, including
  both row-lock concurrency tests, passes against PostgreSQL; frontend unit
  tests and production builds pass; Playwright smoke tests pass in a Chromium
  environment.
- **20 — Implementation structure:** authentication and reporting live in
  separate Django apps, transactional business models remain centralized, API
  contracts stay covered by regression tests, and no schema migration is
  generated solely by the app separation.
