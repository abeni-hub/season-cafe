# SEASONS CAKE — Django + PostgreSQL API

Production-grade REST API for the bakery platform: catalogue, POS, custom orders,
payments, inventory ledgers, purchasing, recipes/production, transfers, expenses,
employees, reports and website CMS. The existing React app talks to this API in API
mode; demo mode remains available and never silently falls back to localStorage.

- **Stack**: Django 5.2.19, DRF 3.18.3, SimpleJWT 5.5.1, django-filter 26.2,
  drf-spectacular 0.30.0, psycopg 3.3.9, Pillow 13, WhiteNoise 6, Python 3.13.15
  (3.11+ supported).
- **Database**: PostgreSQL only. SQLite/MySQL are not supported or used.
- **Background jobs**: none. No Celery, Redis, Docker or systemd dependency.

## Quick start (development)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate        # Windows Git Bash; use bin/activate on Linux
pip install -r requirements-dev.txt
cp .env.example .env                 # fill DB + secret if not using local defaults

python manage.py migrate
python manage.py create_admin --email owner@example.com --name "Owner"
# or load the demo dataset (passwords are never hardcoded):
SEED_PASSWORD='choose-a-strong-password' python manage.py seed

python manage.py runserver 8000      # development only
```

Local PostgreSQL defaults (used only when no DB env is configured) are database
`seasons_cake`, user `seasons`, host `localhost`, port `5433` — matching the isolated
cluster used for verification. Override with `DATABASE_URL` or `DB_*` variables.

API: `http://127.0.0.1:8000/api/v1/` · Swagger: `/api/docs/` · Health: `/health/`.

## Apps

| App | Responsibility |
|-----|----------------|
| `accounts` | Custom UUID user, roles, 20-permission matrix, login/refresh/logout/me |
| `core` | Settings singleton, document counters, snapshot/bootstrap, health, errors, pagination, throttles, seed/admin commands |
| `customers` | Individuals/organizations, walk-in singleton, balances |
| `products` | Exactly seven regular products, publication/availability/price |
| `orders` | Sales, custom/organizational/bulk orders, enquiries, quotations, transitions, POS |
| `payments` | Deposits, partial/final payments, refunds, outstanding math |
| `suppliers` / `purchasing` | Suppliers, POs, partial receipts, weighted average costs, supplier payments/balances |
| `inventory` | Items (raw/packaging/finished), multi-location stock ledger, movements, adjustments |
| `recipes` | Per-product recipe with yield and ingredient lines |
| `production` | Batch workflow, ingredient consumption, finished output, order linkage |
| `transfers` | Location transfers with dispatch/receive ledger pairs |
| `expenses` | Categorised operating expenses |
| `employees` | Staff accounts and role administration |
| `reporting` | Dashboard, sales/product/expense/valuation/customer/supplier reports |
| `website` | Public site content, settings, public enquiries/messages |
| `audit` | Activity feed |

## Roles and permissions

Owner and Administrator have all 20 permissions. Manager has all except
`employees.manage`. Cashier: dashboard, POS, orders view, customers, payments view and
manage. Production: dashboard, orders view, production view/manage, inventory view,
recipes manage. Inventory: dashboard, inventory view/manage, purchasing, transfers.
The same matrix is mirrored in the frontend for route/menu display; the backend is
authoritative and returns 401/403 itself.

## API (versioned `/api/v1/`)

Auth: `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/` · Bootstrap:
`bootstrap/` (permission-filtered hydration, public-safe subset when anonymous).

Products: `products/`, `products/<id>/`, `products/<id>/update/`.
Customers: `customers/`, `customers/<id>/`, `customers/<id>/balance/`.
Orders: `orders/`, `orders/create/`, `orders/inquiries/` (public, throttled),
`orders/<id>/`, `.../quotation/`, `.../transition/`, `.../cancel/`, `pos/sales/`.
Payments: `payments/`, `payments/record/`, `payments/refund/`.
Inventory: `inventory/items/`, `inventory/items/create/`, `inventory/stock/`,
`inventory/movements/`, `inventory/adjustments/`.
Purchasing: `suppliers/`, `purchase-orders/`, `<po>/`, `<po>/receive/`, `<po>/cancel/`,
`purchase-receipts/`, `supplier-payments/`, `supplier-balances/`.
Recipes: `recipes/`, `recipes/upsert/`. Production: `batches/`, `batches/create/`,
`batches/<id>/`, `batches/<id>/transition/`.
Transfers: `transfers/`, `<id>/`, `approve/`, `dispatch/`, `receive/`, `cancel/`.
Expenses: `expenses/`, `expenses/create/`.
Employees: `employees/`, `employees/<id>/`.
Reports: `reports/dashboard/`, `sales/`, `products/`, `expenses/`, `valuation/`,
`customer-balances/`, `supplier-balances/`.
Website: `site/` (public), `site/content/`, `site/settings/`, `messages/` (GET staff,
POST public), `messages/<id>/read/`.
Audit: `activity/`.

Pagination uses `{count,next,previous,results}` with `page_size` (default 50, max 200).
Validation errors are `{"detail": "...", "errors": {...}}`; domain errors are 400 with
`detail`. JWT goes in `Authorization: Bearer <access>`.

## Business invariants

- Deposits/payments/refunds are financial events only; they never move stock.
- Enquiries/quotations stay zero-value or quoted and are not counted as revenue until
  fulfilled through the normal order flow.
- POS sales deduct finished stock once inside `transaction.atomic()` with
  `SELECT FOR UPDATE`; `Idempotency-Key`/`idempotencyKey` makes retries safe.
- Fulfilling a confirmed order deducts stock once; cancellation reverses the sale
  movements once (auditable, no negative stock).
- Production completion consumes recipe ingredients × batch/yield and outputs finished
  goods once; completing again cannot double-post.
- Purchases increase stock only on receipt. Partial receipts post separate ledger
  events and update weighted-average cost.
- Transfers post `transfer_out` on dispatch and `transfer_in` on receipt; totals are
  conserved and repeat actions are rejected.
- Negative stock is prevented for sales, production, transfers and removals.
- Outstanding = order total − valid payments + refunds; overpayment/over-refund are
  rejected. Supplier balance = received value − supplier payments.
- Document counters and SKUs are reserved with row locks (`CodeSequence`), preventing
  duplicate codes under concurrency. Unique constraints backstop idempotency keys,
  emails, movement events and line duplicates.

## Seed data

`python manage.py seed` mirrors the frontend demo dataset: 7 products, 22 inventory
items with opening stock, 4 customers, POS history, a custom organizational order,
bulk order, website enquiry, suppliers/POs/receipts, recipes, two batches, two
transfers, expenses, one message, site content, activity and document counters.
Passwords come from `--password` or `SEED_PASSWORD`; if neither is supplied a random
password is generated and printed once. `--reset` clears only demo data and demo staff
emails before seeding.

`python manage.py create_admin --email ...` creates the first owner (env
`ADMIN_EMAIL`/`ADMIN_NAME`/`ADMIN_PASSWORD` are also honoured). No credentials are
hardcoded.

## Tests

Tests run against PostgreSQL (pytest-django creates `test_seasons_cake`):

```bash
pytest                 # 44 workflow/contract tests, --reuse-db by default
```

Coverage includes auth/permissions, bootstrap filtering, custom enquiries/quotations,
deposits/refunds/outstanding, POS idempotency and stock-once deduction, fulfilment and
cancellation reversals, purchase partial receipts/weighted cost/over-receipt,
production consumption/output/order readiness, transfer conservation, supplier
balances, reports, inventory adjustments, employee administration and CMS/public
message rules.

## Production deployment

See [`deploy/CPANEL_DEPLOYMENT.md`](deploy/CPANEL_DEPLOYMENT.md) for the full cPanel +
Passenger + PostgreSQL guide, [`deploy/CHECKLIST.md`](deploy/CHECKLIST.md) for the
hosting verification checklist, and [`deploy/CRON.md`](deploy/CRON.md) for the single
daily `clearsessions` job. Production settings live in `config/settings_prod.py` and
fail fast on missing secrets/DB/allowed hosts. `passenger_wsgi.py` is the Passenger
entry point; never use `runserver` in production.

## Known limitations / assumptions

- The real cPanel account was not accessible during implementation; hosting-specific
  values and log paths must be verified with the checklist.
- No file-upload endpoints exist yet; `MEDIA_ROOT` is prepared but not served by
  WhiteNoise. Configure a protected media path before adding uploads.
- Emails/SMS are not sent (no provider configured); website messages and enquiries are
  stored for staff follow-up.
- Schedules are handled by cPanel cron only; no Celery/Redis.
- `python manage.py check --deploy` may warn about HSTS/SSL while testing over plain
  HTTP; production requires HTTPS.
