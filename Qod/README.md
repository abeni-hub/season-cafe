# Seasons Cake — Bakery Platform

A commercial-grade bakery platform for **Seasons Cake**: a public brand website plus a role-based
Business Management System (BMS) covering POS, orders, custom and corporate orders, inventory,
purchasing, recipes, production, transfers, payments, expenses, staff and reporting.

> **Two runtime modes, one codebase.**
>
> - **API mode** (default for production): set `VITE_API_BASE_URL` and every screen reads and writes
>   through the Django REST API in [`backend/`](backend/README.md). Authentication is JWT, authorisation
>   is enforced server-side, and mutations re-hydrate from `GET /api/v1/bootstrap/`. There is **no
>   silent fallback** to demo data: network or API errors surface as errors.
> - **Demo mode** (`VITE_API_BASE_URL` empty): the same UI runs against a clearly labelled local demo
>   adapter in browser `localStorage`. This mode is kept for offline demos and the Vitest suites.
>
> The backend is a complete Django 5 + DRF + PostgreSQL service with migrations, seed data, 44
> automated tests and a cPanel/Passenger deployment guide. See
> [`backend/README.md`](backend/README.md) and [`backend/deploy/CPANEL_DEPLOYMENT.md`](backend/deploy/CPANEL_DEPLOYMENT.md).

---

## 1. Stack

| Layer | Choice |
| --- | --- |
| UI | React 18 + TypeScript (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3.4 with brand design tokens |
| Routing | React Router 6 |
| Icons | Lucide |
| Charts | Recharts 2 |
| Tests | Vitest (service-level journeys) + pytest/pytest-django (backend) |
| State | Small typed external store (`useSyncExternalStore`) hydrated from the API or demo adapter |
| Money | Integer minor units (kobo/cents) everywhere |
| API | Django 5.2 + DRF 3.18 + PostgreSQL (psycopg 3), SimpleJWT, django-filter, drf-spectacular |
| Backend extras | Pillow, WhiteNoise, django-cors-headers, python-dotenv; no Celery/Redis required |

## 2. Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (demo mode unless VITE_API_BASE_URL is set)
npm run typecheck  # tsc --noEmit
npm test           # Vitest workflow suites
npm run build      # typecheck + production bundle
```

To run against the real API, start the backend first (see [`backend/README.md`](backend/README.md)),
then:

```bash
cp .env.example .env.local      # set VITE_API_BASE_URL=http://127.0.0.1:8010
npm run dev
```

`VITE_API_BASE_URL` may end in `/api`, `/api/v1` or neither — the client normalises to `/api/v1`.
The Django dev server must list the frontend origin in `CORS_ALLOWED_ORIGINS` (the default allows
`:5173`; add your dev port if you use another).

### Demo accounts

**Demo mode:** password for every seeded account is `seasoncake` (the login screen lists them).

**API mode:** accounts come from the Django database. `python manage.py seed` creates the same six
emails below; their password is whichever you pass via `--password` or `SEED_PASSWORD` (never
hardcoded).

| Role | Email |
| --- | --- |
| Owner | `owner@seasonscake.demo` |
| Administrator | `admin@seasonscake.demo` |
| Manager | `manager@seasonscake.demo` |
| Cashier | `cashier@seasonscake.demo` |
| Production staff | `production@seasonscake.demo` |
| Inventory staff | `inventory@seasonscake.demo` |

The login screen lists these accounts; click one to prefill (demo mode only). **Administration →
Website & settings → Reset demo data** restores the demo dataset and is hidden in API mode; there,
re-seeding is a server command (`python manage.py seed --reset`).

## 3. Routes

### Public website (`SiteLayout`)

| Route | Purpose |
| --- | --- |
| `/` | Hero, values, three featured products, locations, custom-order CTA |
| `/products` | The seven regular products from the catalogue |
| `/products/:slug` | Product detail with price and order CTA |
| `/about` | Brand story from CMS-managed copy |
| `/gallery` | Labelled placeholder tiles with CMS captions |
| `/custom-orders` | Validated custom / corporate / bulk inquiry → creates an `INQ` order |
| `/contact` | Message form; contact channels shown only when published |
| `*` | Friendly not-found page |

### Business Management System (`/admin`, guarded)

| Route | Module | Permission |
| --- | --- | --- |
| `/admin/login` | Sign in | — |
| `/admin` | Dashboard (finance cards hidden without `finance.view`) | `dashboard.view` |
| `/admin/pos` | Point of sale + receipt + transaction history | `pos.use` |
| `/admin/orders` | All order types, filters, balances | `orders.view` |
| `/admin/orders/:id` | Order detail, status flow, payments, stock events | `orders.view` |
| `/admin/custom-orders` | Custom / corporate / bulk desk with quotations | `orders.view` |
| `/admin/customers` | Individuals & organisations, history, balances | `customers.manage` |
| `/admin/payments` | Payment & refund ledger | `payments.view` |
| `/admin/inventory` | Stock levels per location + movement ledger + adjustments | `inventory.view` |
| `/admin/purchasing` | Suppliers, POs, receipts, supplier balances | `purchasing.manage` |
| `/admin/production` | Batch lifecycle, material checks, scheduling | `production.view` |
| `/admin/recipes` | Recipes, batch costing, margins | `recipes.manage` |
| `/admin/transfers` | Home Bakery ↔ Café transfer lifecycle | `transfers.manage` |
| `/admin/expenses` | Operating expenses by category | `expenses.manage` |
| `/admin/reports` | Collections, expenses, product performance, valuation, balances | `reports.view` |
| `/admin/products` | Catalogue editor (fixed seven products) | `products.manage` |
| `/admin/employees` | Staff accounts & role assignment | `employees.manage` |
| `/admin/website` | CMS copy, settings, enquiries, demo reset | `cms.manage` |

Navigation is permission-filtered. Service functions call `requirePermission` independently, so hiding
a link is never the only control. In production the Django API must remain authoritative.

## 4. Architecture

```
src/
  app/            layouts (Site, BMS), guards, scroll restoration
  components/     ui primitives (button, field, modal, table, toast, confirm) + shared brand components
  config/         brand tokens, permissions matrix
  features/       website, auth, dashboard, pos, orders, custom-orders, customers, payments,
                  inventory, purchasing, production, recipes, transfers, expenses, reports,
                  products, employees, website CMS
  hooks/          store/session/permission/money hooks
  services/
    api/          fetch client (JWT refresh, error mapping, idempotency), bootstrap hydration, session
    live/         facades used by the UI: demo implementation or REST implementation behind the same types
    demo/         local demo adapter (seed, store, ledger) — demo mode and Vitest
  types/          domain models
  utils/          money, dates, ids, classnames
  styles/         Tailwind layers and component classes

backend/
  config/         settings, production settings, URLs, WSGI/ASGI
  apps/           accounts, customers, products, orders, payments, inventory, suppliers, purchasing,
                  recipes, production, transfers, expenses, employees, reporting, website, audit, core
  deploy/         cPanel/Passenger guide, hosting checklist, cron notes
  tests/          pytest suites (44 tests against PostgreSQL)
```

Key decisions:

- **Single inventory ledger.** `stock` is derived from `movements`; stock is never a loose number.
  Locations are first-class (`home_bakery`, `cafe`).
- **Idempotent side effects.** Sale deduction, production output, production consumption, transfer
  dispatch/receipt and order cancellation reversals all check `refId` before writing, preventing
  double deduction/creation.
- **Order accounting in one place.** `orderTotals()` computes total, paid, refunded and balance
  (`total − (paid − refunded)`). Quotations are not revenue; deposits are not completed sales.
- **Integer money.** All amounts are minor units. `parseMoneyToCents` validates input; `formatCents`
  renders via `Intl.NumberFormat` using the configured currency (default NGN).
- **Distinct production events.** Completion writes one `production_consumption` per recipe line and
  one `production_output`, then links an order from `in_production` to `ready`.
- **Purchasing ≠ stock.** A purchase order changes nothing physically; only a receipt adds stock and
  recalculates weighted average cost.

- **One facade per domain.** Components import from `src/services/live/*`, never from `api/` or
  `demo/` directly. Each facade checks `HAS_REMOTE_API` once and delegates; return types are
  `T | Promise<T>`, and callers `await` mutations so both modes share one code path.
- **No silent fallback.** In API mode a failed request raises `AppError`; the UI shows the error and
  never substitutes demo data.
- **Idempotent server-side effects.** POS sales, order payments, refunds and supplier payments send
  an `Idempotency-Key` header generated with `newIdempotencyKey()`; the backend stores it and
  replays the original result on retry.

### Implemented invariants

1. Deposits/partial payments never move stock (payments service touches payments only).
2. Stock is deducted only at POS sale or order fulfilment, once (`refId` guard).
3. Cancelling a fulfilled order writes one `return` per sale movement; repeat cancellation is rejected.
4. Transfers write exactly one out movement on dispatch and one in movement on receipt; dispatch
   requires approval and source stock; duplicate dispatch/receipt is rejected.
5. Purchase orders do not affect stock; receipts respect ordered quantities and update costs.
6. Production completion consumes ingredients and creates finished goods as separate movements once.
7. Outstanding balance is always recalculated from ledger payments.
8. Refunds cannot exceed net paid; payments cannot exceed the balance.

## 5. Testing

```bash
npm test                                  # 12 Vitest journeys (demo adapter)
cd backend && pytest                      # 44 API/domain tests (PostgreSQL)
```

`src/services/workflows.test.ts` covers:

- **POS journey** — sale, stock deduction, payment role, insufficient stock, duplicate lines.
- **Custom order journey** — inquiry → quotation → confirmation → deposit (no stock movement) →
  batch → QC → completion (ingredient consumption + finished output) → ready → fulfilment → final
  payment.
- **Inventory journey** — PO (no stock) → receipt (+stock) → production → transfer (conserved) →
  sale; plus cancelled-transfer conservation.
- **Payment journey** — deposit → partial → overpayment rejection → final → refund → balance;
  cancellation reversal exactly once.
- **Permission journey** — cashier/purchasing/inventory/staff restrictions, production capabilities,
  inventory receipt capability, unauthenticated rejection.

## 6. Backend API (implemented)

The Django service lives in [`backend/`](backend/README.md). Summary:

### Conventions

- Base URL: `VITE_API_BASE_URL`, normalised to `/api/v1` by the frontend client.
- Auth: JWT (SimpleJWT). Access token in `Authorization: Bearer …`; access/refresh pair stored in
  `localStorage` under `seasons-cake.tokens.v1`. A 401 triggers a single-flight refresh and one retry;
  if refresh fails, tokens are cleared and a `seasons:auth-expired` event returns the UI to sign-in.
  Logout blacklists the refresh token server-side.
- Hydration: after login the app calls `GET /api/v1/bootstrap/`, which returns the permission-filtered
  dataset (public-safe subset when anonymous). Every mutation is followed by a re-hydration.
- Money fields: integer minor units (`*Cents` / `*_cents`), serialized as camelCase.
- Dates: ISO 8601; IDs: UUID strings for orders/batches/transfers, stable codes (`POS-1008`,
  `ORD-2003`, `INQ-3002`, `PO-5001`, `TRF-6002`, `BATCH-7004`) for humans.
- Pagination: `?page=&page_size=` → `{ count, next, previous, results }` (default 50, max 200).
- Errors: `{ "detail": "<first message>", "errors": { "<field>": [...] } }`; the client maps `detail`
  to toasts and `errors` to field messages.
- Idempotency: POS sales, order payments, refunds and supplier payments accept an
  `Idempotency-Key` header (also a body `idempotencyKey`); safe retries return the original result.

### Endpoint groups

| Area | Endpoints (under `/api/v1/`) |
| --- | --- |
| Auth | `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/` |
| Hydration | `bootstrap/` |
| Catalogue | `products/`, `products/<id>/`, `products/<id>/update/` |
| Public content | `site/`, `site/content/`, `site/settings/` |
| Enquiries | `orders/inquiries/` (public, throttled), `messages/` (POST public, GET staff), `messages/<id>/read/` |
| Customers | `customers/`, `customers/<id>/`, `customers/<id>/balance/` |
| Orders | `orders/`, `orders/create/`, `orders/<id>/`, `orders/<id>/quotation/`, `orders/<id>/transition/`, `orders/<id>/cancel/` |
| POS | `pos/sales/` (atomic order + payment + stock movements) |
| Payments | `payments/`, `payments/record/`, `payments/refund/` |
| Inventory | `inventory/items/`, `inventory/items/create/`, `inventory/stock/`, `inventory/movements/`, `inventory/adjustments/` |
| Purchasing | `suppliers/`, `purchase-orders/`, `purchase-orders/<id>/receive/`, `<id>/cancel/`, `purchase-receipts/`, `supplier-payments/`, `supplier-balances/` |
| Recipes | `recipes/`, `recipes/upsert/` |
| Production | `batches/`, `batches/create/`, `batches/<id>/transition/` |
| Transfers | `transfers/`, `transfers/<id>/approve/`, `dispatch/`, `receive/`, `cancel/` |
| Expenses | `expenses/`, `expenses/create/` |
| Staff | `employees/`, `employees/<id>/` |
| Reports | `reports/dashboard/`, `reports/sales/`, `reports/products/`, `reports/expenses/`, `reports/valuation/`, `reports/customer-balances/`, `reports/supplier-balances/` |
| Audit | `activity/` |
| Docs | OpenAPI at `/api/schema/`, Swagger UI at `/api/docs/`, health at `/health/` |

### Security model

- DRF is `IsAuthenticated` by default; public endpoints (site, messages POST, inquiries, health) opt
  out explicitly and are throttled (`public_write` 20/hour by default, `login` 10/min).
- Roles `owner | admin | manager | cashier | production | inventory` map to a 20-permission matrix
  enforced in DRF permission classes. The frontend mirrors the matrix for navigation only; the server
  returns 401/403 itself.
- CORS is restricted to `CORS_ALLOWED_ORIGINS` and explicitly allows the `idempotency-key` header.
- Production settings (`config/settings_prod.py`) fail fast without a secret key, database URL,
  allowed hosts and HTTPS origins. `runserver` is development-only.

### Verification performed

The full UI was exercised against the live Django API and PostgreSQL: storefront hydration, owner
sign-in, POS sale (stock deducted once), order transition + payment, anonymous enquiry → quotation →
confirmation → deposit, inventory adjustment, expense, PO receipt, supplier payment, transfer
lifecycle, production batch create/advance/complete, recipe upsert, catalogue toggle, staff account
creation, CMS content/settings save, contact message → BMS inbox → mark read, sign-out with token
revocation, and a server-side 403 check with a restricted role. The demo adapter was not used in API
mode at any point.

## 7. Brand system

- Logo: `/public/brand/season-cake-logo.png` (supplied asset, used on site, login and footer).
- Tokens: `tailwind.config.js` — forest greens, warm clay/terracotta, cream/beige paper, refined ink,
  Fraunces display type, Manrope body, Cormorant accent.
- Shared UI primitives and `ProductArt` illustrations keep the public site and BMS visually coherent.
  Product imagery is deliberately illustrative demo art, not claimed photography.

## 8. Assumptions & limitations

- Currency defaults to **NGN**; it is configurable in settings and affects formatting only.
- Prices, customers, suppliers, orders, messages and history in the seed are **explicitly labelled
  demo records**. Contact details, addresses and opening hours are empty until the business publishes
  them; the UI says so instead of inventing facts.
- The regular catalogue is fixed at seven products; there is no create/delete product flow by design.
- Receipts are print-friendly browser views, not server-generated PDFs.
- Reports compute cash collections minus recorded expenses; they are not statutory profit statements
  (COGS/payroll policy is out of scope).
- Demo mode persists in `localStorage` under `seasons-cake.db.v1`; clearing site data or using
  **Reset demo data** restores the seed. In API mode nothing is stored in the browser except the JWT.
- No email/SMS is sent by either mode; enquiries and messages are stored for staff follow-up.
- Product and gallery imagery remains illustrative; there are no upload endpoints yet.
- Automated coverage is service-level (Vitest + pytest); no browser E2E harness is committed. The
  API-mode checks above were performed manually against a local PostgreSQL cluster.
- The backend was verified on Python 3.13 / PostgreSQL 18 locally; cPanel specifics (Passenger
  paths, log locations, SSL) must be confirmed per host using `backend/deploy/CHECKLIST.md`.

## 9. Recommended next steps

1. Add object storage and upload endpoints for product/gallery imagery, then swap the illustrative art.
2. Generate PDF quotations/receipts server-side and connect an email provider for enquiries.
3. Add Playwright E2E journeys (POS sale, custom-order quotation, production completion) against the
   API, and keep Vitest for service logic.
4. Add COGS-based profitability and stock-movement reporting once purchase and payroll policy is
   agreed.
5. Harden public endpoints with CAPTCHA/honeypot and monitor `public_write` throttle headroom.
6. Configure scheduled PostgreSQL backups in cPanel alongside the documented cron job.
