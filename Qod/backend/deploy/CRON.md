# Cron jobs

No Celery or Redis is used. Django runs inside Passenger and all stock/payment
mutations are synchronous database transactions.

Add one daily job in cPanel → Cron Jobs (paths are examples):

```cron
15 2 * * * /home/CPANEL_USER/virtualenv/backend/3.11/bin/python /home/CPANEL_USER/apps/seasons-cake/backend/manage.py clearsessions >> /home/CPANEL_USER/logs/seasons-cron.log 2>&1
```

Replace the Python path with the one shown by cPanel's "Setup Python App" screen.
`clearsessions` removes expired session rows; JWT access tokens are stateless and
expired refresh tokens are pruned by blacklist maintenance when used.

Backups: schedule a database export from cPanel or, if `pg_dump` is available:

```cron
30 1 * * * pg_dump "$DATABASE_URL" > /home/CPANEL_USER/backups/seasons-$(date +\%F).sql
```

Keep backups outside `public_html`.
