# Seasons Cake BMS — cPanel Shared Hosting Deployment Guide

This guide explains how to deploy the entire **Seasons Cake** platform (Django API backend, React BMS Admin Portal, and React Public Website) on low-cost **cPanel Shared Hosting** (e.g., Namecheap, Hostinger, Bluehost, cPanel CloudLinux, A2 Hosting) without requiring dedicated VPS or Docker infrastructure.

---

## 1. Architecture Overview on cPanel

Shared hosting provides **cPanel**, Apache web server, MySQL databases, and the **"Setup Python App"** tool (powered by CloudLinux Phusion Passenger).

```
                      Client Browser / Mobile Devices
                                     │
                                     ▼
                     Apache Web Server (.htaccess)
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      │                              │                              │
      ▼                              ▼                              ▼
/ (Public Website)            /bms/ (BMS Portal)            /api/ & /admin/
Static HTML/CSS/JS            Static HTML/CSS/JS           Phusion Passenger WSGI
(Built via Vite)              (Built via Vite)             (Python 3.11/3.12 Django)
                                                                    │
                                                     ┌──────────────┴──────────────┐
                                                     ▼                             ▼
                                              SQLite3 Database             cPanel MySQL Database
                                              (db.sqlite3 - default)       (Optional upgrade)
```

---

## 2. Prerequisites & Preparation

1. **cPanel Account** with **"Setup Python App"** enabled (found under the **Software** section in cPanel).
2. **Local Machine** with Node.js 18+ and Python 3.10+ installed to build frontend assets.

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Build Frontend Assets Locally

Before uploading, build the production bundles on your computer:

```bash
# 1. Build the Public Website
npm run build
# Output is generated in the `dist/` directory.

# 2. Build the BMS Management System
npm --prefix bms-frontend run build
# Output is generated in `bms-frontend/dist/`.
```

### Step 2: Set Up Python Application in cPanel

1. Log into your **cPanel**.
2. Scroll to the **Software** section and click **"Setup Python App"**.
3. Click **"Create Application"**:
   - **Python Version**: Select **3.11** or **3.12** (or 3.10 minimum).
   - **Application Root**: `season_backend` (or a folder outside `public_html`).
   - **Application URL**: `api` (or your subdomain, e.g., `api.yourdomain.com`).
   - **Application Startup File**: `passenger_wsgi.py`
   - **Application Entry Point**: `application`
4. Click **"CREATE"**.
5. Once created, cPanel will display a command to activate the virtual environment at the top of the page. It looks like:
   ```bash
   source /home/cpaneluser/virtualenv/season_backend/3.11/bin/activate && cd /home/cpaneluser/season_backend
   ```
   *Copy this command.*

### Step 3: Upload Backend Files

1. Open **cPanel File Manager** or connect via **FTP (FileZilla)**.
2. Go to `/home/cpaneluser/season_backend/`.
3. Upload all contents of the `backend/` directory from this project:
   - `season_api/`
   - `seasonops/`
   - `accounts/`
   - `reporting/`
   - `website/`
   - `manage.py`
   - `requirements.txt`
   - `passenger_wsgi.py`
4. Ensure `passenger_wsgi.py` contains:
   ```python
   import os
   import sys

   SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
   if SCRIPT_DIR not in sys.path:
       sys.path.insert(0, SCRIPT_DIR)

   os.environ.setdefault("DJANGO_SETTINGS_MODULE", "season_api.settings")
   from season_api.wsgi import application
   ```

### Step 4: Install Python Dependencies & Migrate Database

1. In cPanel, open **Terminal** (under the Advanced section) or use SSH:
2. Paste the command copied in Step 2 to enter your virtual environment:
   ```bash
   source /home/cpaneluser/virtualenv/season_backend/3.11/bin/activate && cd /home/cpaneluser/season_backend
   ```
3. Install the required Python packages:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Set up environment variables. You can add these in the **"Setup Python App"** UI under **Environment Variables**, or in a `.env` file:
   ```env
   DJANGO_DEBUG=0
   DJANGO_SECRET_KEY=generate-a-strong-random-50-character-key-here
   DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,bms.yourdomain.com
   DJANGO_CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://bms.yourdomain.com
   ```
5. Run migrations and collect static files:
   ```bash
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```
6. Seed the initial Seasons Cake accounts & catalog:
   ```bash
   python manage.py seed_demo
   ```
   *(This creates the Owner, Cashier, Baker, and Manager accounts, along with the two branch locations: Home Bakery and Bole Café).*

### Step 5: Upload Frontend Static Files to `public_html`

1. In cPanel File Manager, open `/home/cpaneluser/public_html/`.
2. **Public Website**:
   - Upload the contents of your local `dist/` folder directly into `/home/cpaneluser/public_html/`.
   - Copy `cpanel_deployment/public_html/.htaccess` into `/home/cpaneluser/public_html/.htaccess`.
3. **BMS Portal**:
   - Create a subfolder `/home/cpaneluser/public_html/bms/`.
   - Upload the contents of `bms-frontend/dist/` into `/home/cpaneluser/public_html/bms/`.
   - Copy `cpanel_deployment/public_html/bms/.htaccess` into `/home/cpaneluser/public_html/bms/.htaccess`.

### Step 6: Restart the Python Application

1. In cPanel, return to **"Setup Python App"**.
2. Click **"RESTART"** on your Seasons Cake application.
3. Test your endpoints:
   - Public Website: `https://yourdomain.com/`
   - BMS Portal: `https://yourdomain.com/bms/`
   - Django Admin: `https://yourdomain.com/admin/`
   - API Docs: `https://yourdomain.com/api/v1/schema/swagger-ui/`

---

## 4. Database Selection: SQLite vs. MySQL on cPanel

### Option A: SQLite (Recommended for Budget Shared Hosting)
- **Why**: Zero configuration, zero memory footprint, and no external daemon to crash or hit connection limits on cheap shared hosts.
- **Reliability**: Perfect for a boutique bakery handling hundreds of orders daily.
- **Backup**: Simply backup the file `/home/cpaneluser/season_backend/db.sqlite3`.

### Option B: MySQL / MariaDB (If preferred by client)
1. In cPanel, click **"MySQL Database Wizard"**.
2. Create database (e.g., `cpaneluser_seasons`) and user with full privileges.
3. In cPanel "Setup Python App", add the environment variable:
   ```env
   DATABASE_URL=mysql://cpaneluser_user:YourStrongPassword@localhost:3306/cpaneluser_seasons
   ```
4. Run `pip install pymysql` in the virtualenv.
5. Run `python manage.py migrate`.

---

## 5. Automated Backups via cPanel Cron Jobs

Protecting customer orders and financial balances is critical. Set up an automated daily backup:

1. In cPanel, open **"Cron Jobs"**.
2. Set frequency to **Once a day at midnight** (`0 0 * * *`).
3. For SQLite:
   ```bash
   tar -czf /home/cpaneluser/backups/season_backup_$(date +\%F).tar.gz /home/cpaneluser/season_backend/db.sqlite3 /home/cpaneluser/season_backend/media/
   ```
4. This keeps a timestamped archive of all orders, recipes, inventory transactions, and cake photos in a secure `/backups/` directory!
