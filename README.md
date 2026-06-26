# ACTIZO CRM — Backend API

Production-style REST API for **ACTIZO CRM**, built with **Node.js (ESM) + Express** and **Supabase (PostgreSQL)**. It mirrors the entire frontend feature set: PIN + role authentication, leads & the lead workflow, follow-ups, sales, products, targets (general/special/project), incentives, branches, users (admin / branch manager / staff), finance, dashboard, reports, activities and notifications.

> The frontend is **not** wired to this API yet — this is a complete, self-contained backend implementation ready to connect.

---

## 🧱 Tech Stack

- **Runtime:** Node.js ≥ 18 (ESM)
- **Framework:** Express 4
- **Database:** Supabase / PostgreSQL (`@supabase/supabase-js`, service-role on the server)
- **Auth:** Role + 6-digit PIN → JWT (access + refresh), bcrypt-hashed PINs
- **Validation:** express-validator · **Security:** helmet, cors, rate-limit · **Logging:** morgan

## 📁 Structure

```
backend/
├── package.json
├── .env.example
└── src/
    ├── server.js            # entry — boots the HTTP server
    ├── app.js               # express app (security, parsing, routes, errors)
    ├── config/
    │   ├── env.js           # env loading + validation
    │   ├── supabase.js      # service-role + anon clients
    │   └── constants.js     # roles, statuses, categories, RBAC map
    ├── middleware/
    │   ├── auth.js          # JWT authenticate / optionalAuth
    │   ├── rbac.js          # authorize(roles), branchScope
    │   ├── validate.js      # express-validator runner
    │   ├── rateLimiter.js   # api + auth limiters
    │   └── errorHandler.js  # notFound + central error handler
    ├── utils/               # ApiError, ApiResponse, asyncHandler, jwt, pin, pagination, logger
    ├── models/              # data-access layer (Supabase queries) per table
    ├── services/            # business logic
    ├── controllers/         # request/response handlers
    ├── validators/          # request validation schemas
    ├── routes/              # express routers (index.js mounts all)
    └── db/
        ├── schema.sql       # tables, enums, indexes, triggers
        ├── policies.sql     # Row Level Security policies
        ├── runSql.js        # apply a .sql file (npm run db:push)
        └── seed.js          # demo data (npm run db:seed)
```

Each domain follows the same layering: **route → controller → service → model → Supabase**.

## 🚀 Setup

```bash
cd backend
npm install
cp .env.example .env        # fill in Supabase URL, keys, DATABASE_URL, JWT_SECRET

# 1) apply the schema (and optionally RLS policies)
npm run db:push             # runs src/db/schema.sql via DATABASE_URL
node src/db/runSql.js policies.sql

# 2) seed demo data (branches, users, products, finance)
npm run db:seed

# 3) run
npm run dev                 # http://localhost:5000/api
```

Get the values from your Supabase project: **Settings → API** (URL, anon, service-role) and **Settings → Database** (connection string → `DATABASE_URL`).

## 🔐 Authentication

Role + 6-digit PIN, matching the frontend. `POST /api/auth/login` with `{ role, pin }` returns a session + `accessToken` / `refreshToken`. Send `Authorization: Bearer <accessToken>` on subsequent requests.

Seeded demo PINs: **Admin `123456` · Branch Manager `112233` · Sales Staff `445566`.**

RBAC mirrors the UI: **Admin** = full access; **Branch Manager** = branch-scoped management (leads, sales, targets, incentives, branches, staff/users, reports); **Sales Staff** = their own leads, follow-ups, sales, targets, incentives.

## 📚 API Endpoints (base: `/api`)

| Resource | Endpoints |
| --- | --- |
| **Auth** | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| **Users** | `GET /users` · `POST /users` · `GET/PATCH/DELETE /users/:id` · `PATCH /users/:id/status` · `PATCH /users/:id/reset-pin` |
| **Branches** | `GET /branches` · `POST /branches` · `GET/PATCH/DELETE /branches/:id` · `GET /branches/:id/stats` |
| **Products** | `GET /products` · `GET /products/categories` · `POST /products` · `GET/PATCH/DELETE /products/:id` · `PATCH /products/:id/status` |
| **Leads** | `GET /leads` · `GET /leads/stats` · `POST /leads` · `GET/PATCH/DELETE /leads/:id` · `PATCH /leads/:id/assign` · `PATCH /leads/:id/status` · `POST /leads/:id/follow-ups` |
| **Follow-ups** | `GET /follow-ups` · `GET /follow-ups/upcoming` · `POST /follow-ups` · `PATCH/DELETE /follow-ups/:id` |
| **Sales** | `GET /sales` · `GET /sales/stats` · `POST /sales` · `GET/PATCH/DELETE /sales/:id` |
| **Targets** | `GET /targets/summary` · `GET/POST /targets/:type` · `GET/PATCH/DELETE /targets/:type/:id`  *(type = general \| special \| project)* |
| **Incentives** | `GET /incentives` · `GET /incentives/history` · `GET /incentives/summary` · `POST /incentives` · `GET/PATCH/DELETE /incentives/:id` |
| **Finance** | `GET /finance/overview` · `GET /finance/charts` |
| **Dashboard** | `GET /dashboard` |
| **Reports** | `GET /reports/:type`  *(lead, sales, revenue, branch, staff, target, incentive)* |
| **Activities** | `GET /activities` · `POST /activities` |
| **Notifications** | `GET /notifications` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` · `POST /notifications` |

Health check: `GET /health`.

## 📦 Response Shape

```jsonc
// success
{ "success": true, "message": "OK", "data": { /* ... */ }, "meta": { "page": 1, "limit": 10, "total": 64, "totalPages": 7 } }
// error
{ "success": false, "message": "Validation failed", "details": [ { "field": "pin", "message": "PIN must be exactly 6 digits" } ] }
```

## 🔗 Connecting the frontend (later)

Point the frontend's axios `VITE_API_URL` to `http://localhost:5000/api`, store the `accessToken` from `/auth/login`, and swap the mock-data reads in the Redux slices for API calls. The response/field shapes already mirror the frontend's data model.
