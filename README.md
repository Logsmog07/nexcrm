# CRM Analytics & Sales Intelligence System

Modern full-stack CRM with:

- JWT authentication
- role-based access
- leads, customers, deals, activities
- analytics dashboard and sales insights
- React + Tailwind frontend
- Express + PostgreSQL backend

## Stack

- Frontend: React, Vite, Tailwind CSS, Redux Toolkit, Axios, Recharts
- Backend: Node.js, Express, JWT, bcrypt, pg
- Database: PostgreSQL

## Project layout

- Backend API: [backend/index.js](backend/index.js)
- Frontend app: [frontend/src/App.jsx](frontend/src/App.jsx)
- DB schema: [backend/src/db/migrations/001_init_crm_schema.sql](backend/src/db/migrations/001_init_crm_schema.sql)
- DB seed: [backend/src/db/migrations/002_seed_dev_data.sql](backend/src/db/migrations/002_seed_dev_data.sql)

## 1. Prerequisites

- Node.js 20+ recommended
- npm
- PostgreSQL 14+ recommended

## 2. Install dependencies

From the project root:

```bash
npm install
cd frontend
npm install
cd ..
```

Note: `frontend/package.json` was updated to explicitly include `@reduxjs/toolkit` and `react-redux`, so running `npm install` inside `frontend/` is important before first run.

## 3. Create the database

Create a PostgreSQL database named `crm_db`.

Example:

```bash
createdb crm_db
```

If `createdb` is not available, create it through `psql`:

```sql
CREATE DATABASE crm_db;
```

## 4. Configure environment variables

Create backend env file:

```bash
cp backend/.env.example backend/.env
```

Create frontend env file:

```bash
cp frontend/.env.example frontend/.env
```

Default backend env values:

```env
PORT=3001
CLIENT_URL=http://localhost:5174
JWT_SECRET=super-secret-jwt-key
JWT_EXPIRES_IN=7d
DB_USER=postgres
DB_HOST=localhost
DB_NAME=crm_db
DB_PASSWORD=postgres
DB_PORT=5432
DB_SSL=false

# Production (Supabase/Vercel): use a single connection string instead of DB_*.
# DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
```

When deploying the backend to Vercel, set `DATABASE_URL` in Vercel Project → Settings → Environment Variables.
Do not commit your real `.env` to GitHub.

Developer portal env values (optional):

```env
DEVELOPER_PORTAL_ENABLED=true
DEVELOPER_PORTAL_EMAIL=you@yourdomain.com
DEVELOPER_PORTAL_PASSWORD=UseAVeryStrongPassword123!
DEVELOPER_PORTAL_NAME=Your Name - Developer Console
DEVELOPER_PORTAL_DEFAULT_PREVIEW_ROWS=40
DEVELOPER_PORTAL_MAX_PREVIEW_ROWS=200
```

When enabled, backend startup auto-creates/refreshes this dedicated account and grants access to the isolated developer database console at `/developer`.

If your local Postgres password is different, update `backend/.env`.

## 5. Run schema and seed SQL

From the project root:

```bash
psql -U postgres -d crm_db -f backend/src/db/migrations/001_init_crm_schema.sql
psql -U postgres -d crm_db -f backend/src/db/migrations/002_seed_dev_data.sql
psql -U postgres -d crm_db -f backend/src/db/migrations/003_multitenant_workspace.sql
psql -U postgres -d crm_db -f backend/src/db/migrations/004_seed_company_hierarchy.sql
psql -U postgres -d crm_db -f backend/src/db/migrations/005_audit_logs.sql
psql -U postgres -d crm_db -f backend/src/db/migrations/006_audit_retention_and_indexes.sql
psql -U postgres -d crm_db -f backend/src/db/migrations/007_user_settings.sql
```

If your Postgres user is not `postgres`, replace it with your own username.

## 6. Start the backend

From the project root:

```bash
npm run server
```

For auto-reload during development:

```bash
npm run server:dev
```

Backend base URL:

```text
http://localhost:3001/api
```

Health endpoint:

```text
http://localhost:3001/health
```

## 7. Start the frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

Frontend URL:

```text
http://localhost:5174
```

## 8. Demo login accounts

Seeded password for all demo users:

```text
Password123!
```

Accounts:

- Admin: `admin@crm.local`
- Manager: `manager@crm.local`
- Sales rep: `sales@crm.local`

## 9. Production build check

Frontend:

```bash
cd frontend
npm run build
```

Backend syntax smoke check:

```bash
find backend -name '*.js' -print0 | xargs -0 -n1 node --check
```

## 10. Main routes

Frontend:

- `/login`
- `/signup`
- `/`
- `/leads`
- `/customers`
- `/pipeline`
- `/activities`
- `/analytics`
- `/audit`
- `/developer` (developer account only)

Backend API:

- `/api/auth`
- `/api/users`
- `/api/leads`
- `/api/customers`
- `/api/deals`
- `/api/activities`
- `/api/analytics/dashboard`
- `/api/notifications`
- `/api/audit/logs`
- `/api/audit/logs/export`
- `/api/settings`
- `/api/dev/*` (developer account only)

Audit export params:

- `action`, `entityType`, `outcome`, `actorUserId`, `from`, `to` (same as list filters)
- `exportLimit` (optional, default `1000`, max `5000`)
- `format` (optional, `csv` or `json`, default `csv`)
- `compress` (optional boolean, only for `format=csv`; `true` returns `.csv.gz`)

Audit maintenance:

```bash
npm run audit:prune
```

## 11. One-command full QA

Keep backend and frontend running first:

```bash
npm run server:dev
cd frontend && npm run dev
```

Then run the complete stabilization QA flow from project root:

```bash
npm run qa:full
```

This runs, in order:

- preflight service checks (`/health` and `/login`)
- frontend lint
- frontend production build
- backend JavaScript syntax checks
- Playwright end-to-end tests
- role-based backend API smoke tests

## Troubleshooting

- If login fails immediately, confirm the seed SQL ran successfully and the password in the seed data is still `Password123!`.
- If the backend cannot connect to Postgres, verify `backend/.env` matches your local database credentials.
- If the frontend loads but API calls fail, confirm `frontend/.env` points to `http://localhost:3001/api`.
- If `psql` says the enums or tables already exist, that usually means the schema was already applied.
