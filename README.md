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
2. `POST /api/auth/login` to receive a JWT token
3. Click `Authorize` once in Swagger UI and paste `Bearer <token>` or only the raw token, depending on the prompt shown
4. Call `GET /api/auth/me`, `GET /api/users/me`, and `GET /api/users`

Protected routes:

- `GET /api/auth/me`
- `GET /api/users/me`
- `GET /api/users` (admin only)

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
