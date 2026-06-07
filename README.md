# GIVE Invoice Finance MVP

This repo now includes:

- `frontend/`: React + Vite starter for the financing UI
- `backend/`: Express + TypeScript API with Prisma, SQLite, JWT auth, and Swagger
- `contract/`: existing contract workspace kept as-is

## Frontend

Install dependencies and start the app:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend environment variables:

- `VITE_API_URL`: backend API base URL
- `VITE_APP_NAME`: app name shown in the UI

The frontend includes:

- `src/api/` for axios clients
- `src/components/` for shared UI shell pieces
- `src/pages/` for route screens
- `src/routes/` for routing
- `src/hooks/` for future stateful logic
- `src/utils/` for helpers such as token storage

## Backend

Set up the API:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Useful scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`

Swagger UI:

```text
http://localhost:5000/api-docs
```

Health check:

```text
GET http://localhost:5000/api/health
```

Auth flow to test:

1. `POST /api/auth/register` with `name`, `email`, `password`, and optional `role`
   Allowed self-registration roles: `INVESTOR`, `BORROWER`, `CUSTOMER`
2. `POST /api/auth/login` to receive a JWT token
3. Click `Authorize` once in Swagger UI and paste `Bearer <token>` or only the raw token, depending on the prompt shown
4. Call `GET /api/auth/me`, `GET /api/users/me`, and `GET /api/users`

Protected routes:

- `GET /api/auth/me`
- `GET /api/users/me`
- `GET /api/users` (admin only)

### Stellar contract API

The backend now exposes contract-aware routes under `/api/contract`.

Read endpoints:

- `GET /api/contract/metadata`
- `GET /api/contract/pool`
- `GET /api/contract/position/me`
- `GET /api/contract/invoices/:id`
- `GET /api/contract/requests/:id`

Interaction endpoints:

- `POST /api/contract/actions/deposit`
- `POST /api/contract/actions/withdraw`
- `POST /api/contract/actions/invoices`
- `POST /api/contract/actions/invoices/:id/verify`
- `POST /api/contract/actions/invoices/:id/reject`
- `POST /api/contract/actions/financing/request`
- `POST /api/contract/actions/financing/:id/approve`
- `POST /api/contract/actions/financing/:id/reject`
- `POST /api/contract/actions/financing/:id/borrow`
- `POST /api/contract/actions/settlements/:id/pay`
- `POST /api/contract/actions/platform-fees/withdraw`

These interaction endpoints build Stellar contract invocation XDR using the configured contract and the authenticated user's role. Admin-only contract actions are blocked in middleware before they reach the contract layer.

### Backend Stellar env vars

Add these values in `backend/.env` to enable live contract reads and invocation building:

- `STELLAR_CONTRACT_ID`
- `STELLAR_TOKEN_ADDRESS`
- `STELLAR_RPC_URL`
- `STELLAR_NETWORK_PASSPHRASE`
- `STELLAR_READ_SOURCE_ACCOUNT`
- `STELLAR_ADMIN_SOURCE_ACCOUNT` for admin-only contract invocations
- `STELLAR_CLI_PATH` if `stellar` is not already on the system path

## Database notes

Prisma is configured for SQLite in local development:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

To switch to PostgreSQL or Neon later, update the datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then change `DATABASE_URL` in `.env`, run a new migration, and regenerate the Prisma client.
