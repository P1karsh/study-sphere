# StudySphere

An AI-powered study platform. Right now it has a landing page and working
accounts (sign up, sign in, sign out). The study tools come next.

```
frontend/   React 19 + TypeScript + Vite + Tailwind v4
backend/    FastAPI + SQLAlchemy + Alembic (SQLite locally)
docs/       Design notes - see docs/authentication.md
```

## Running it locally

You need Python 3.12+ and Node 22+.

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # optional - the defaults work for local dev
alembic upgrade head            # creates backend/studysphere.db
uvicorn app.main:app --reload --port 8000
```

API docs are at http://localhost:8000/docs while running in development.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api/*` to the
backend on port 8000, so both servers need to be running.

## Environment variables

**Backend** (`backend/.env`, see `backend/.env.example`):

| Variable            | Default                        | What it does                                        |
| ------------------- | ------------------------------ | --------------------------------------------------- |
| `ENVIRONMENT`       | `development`                  | `production` hides /docs and enforces secure cookies |
| `DATABASE_URL`      | `sqlite:///./studysphere.db`   | Any SQLAlchemy URL                                  |
| `CORS_ORIGINS`      | `http://localhost:5173,...`    | Comma-separated frontend origins allowed to call us  |
| `SESSION_TTL_HOURS` | `168` (7 days)                 | How long a sign-in lasts                            |
| `COOKIE_SECURE`     | `false`                        | Must be `true` in production (HTTPS)                |

**Frontend** (`frontend/.env.local`, see `frontend/.env.example`):

| Variable       | Default | What it does                         |
| -------------- | ------- | ------------------------------------ |
| `VITE_API_URL` | `/api`  | Where the API lives. Not a secret - it ends up in the browser bundle. |

No secrets are needed to run locally.

## API

| Method | Path                 | Auth     | Notes                                       |
| ------ | -------------------- | -------- | ------------------------------------------- |
| POST   | `/api/auth/register` | –        | `{name, email, password}` → 201 + user, signs you in |
| POST   | `/api/auth/login`    | –        | `{email, password}` → 200 + user            |
| POST   | `/api/auth/logout`   | –        | 204, always succeeds                        |
| GET    | `/api/auth/me`       | required | Current user, or 401                        |
| GET    | `/api/health`        | –        | `{"status": "ok"}`                          |

Errors always look like `{"detail": "A message you can show the user"}`.

## Tests

```bash
cd backend && pytest            # 28 tests
cd frontend && npm test         # 17 tests
cd frontend && npm run lint && npm run build
```

## Database migrations

After changing a model in `backend/app/models/`:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## What's done and what isn't

Done:
- Sign up, sign in, sign out, staying signed in across reloads
- Expired sessions drop you back to the landing page
- Validation on both the frontend and the backend

Not done yet:
- **Password reset.** There's no email service, so the "Forgot Password?"
  button says it isn't available yet instead of pretending to send an email.
- Email verification
- Any study features

See [docs/authentication.md](docs/authentication.md) for how auth works and a
production checklist.
