# Authentication

## How it works

StudySphere uses **server-side sessions stored in a cookie**. There are no
JWTs and nothing is kept in `localStorage`.

1. When you sign up or sign in, the backend makes a random 256-bit token
   (`secrets.token_urlsafe(32)`).
2. The token goes to the browser in the `studysphere_session` cookie, which is
   `HttpOnly` (JavaScript can't read it), `SameSite=Lax`, and `Secure` in
   production.
3. The database keeps only a **SHA-256 hash** of the token, along with the user
   id and an expiry time. Anyone who reads the database can't use it to sign in.
4. Every protected request looks up the hash. If it's missing or expired → 401.
5. Signing out deletes the session row, so the old cookie stops working right
   away, even if someone copied it.

### Why this instead of JWTs?

- Sign out really signs you out. A JWT stays valid until it expires unless you
  build a revocation list, and then you have sessions again anyway.
- No refresh-token logic.
- No signing secret to manage.

The cost is one indexed database lookup per request, which is nothing at this
scale.

### Why the dev proxy?

In development Vite forwards `/api` to FastAPI (`frontend/vite.config.ts`), so
the browser sees a single origin. The cookie then works without
`SameSite=None` or cross-site cookie headaches. In production, serve the
frontend and API from the same domain (e.g. `studysphere.app` and
`studysphere.app/api`) behind a reverse proxy and you get the same behaviour.

## Passwords

- Hashed with **argon2id** using `argon2-cffi`'s recommended parameters.
  On sign-in, any hash made with older parameters is quietly re-hashed.
- Policy: 8–128 characters, and not just spaces. The upper limit stops people
  making us hash huge strings.
- A wrong password and an unknown email return the same message
  (`Invalid email or password`). The unknown-email path still does a dummy
  hash check, so response times match too.
- Sign up does say "An account with this email already exists". You can't
  hide that without email verification. Rate limiting makes probing for
  emails slow.

## Other protections

| Threat               | What we do                                                         |
| -------------------- | ------------------------------------------------------------------ |
| CSRF                 | `SameSite=Lax` cookie, plus POST/PUT/PATCH/DELETE requests with an `Origin` header must come from `CORS_ORIGINS` (`app/core/security.py`) |
| Brute force          | 10 login attempts per 5 min and 10 sign-ups per hour, per IP (`app/utils/rate_limit.py`) |
| Huge requests        | Bodies over 64 KB are rejected; field lengths are capped           |
| Cross-origin reads   | CORS allows only `CORS_ORIGINS`, with credentials                  |
| Leaking data         | API responses only include `id`, `name`, `email`, `created_at`     |
| Logging secrets      | Nothing logs request bodies, passwords or tokens                   |

Emails are trimmed and lowercased before they're stored or looked up. The
`users.email` column has a unique index, so duplicates are impossible even if
two sign-ups race.

## Code map

```
backend/app/
  api/auth.py          the four auth routes
  api/deps.py          get_current_user dependency - use it to protect routes
  core/config.py       settings from env / .env
  core/passwords.py    argon2 hashing
  core/security.py     origin check + body size limit middleware
  services/sessions.py create / look up / end sessions, cookie helpers
  schemas/auth.py      request validation and the public user shape
  models/user.py       User and UserSession tables
  utils/rate_limit.py  in-memory rate limiter

frontend/src/
  lib/api.ts           fetch wrapper (cookies, error messages, 401 hook)
  lib/authApi.ts       typed auth calls
  auth/AuthProvider.tsx  current user state, checks /me on load and on tab focus
  auth/authContext.ts    useAuth() hook
  components/AuthSheet.tsx  sign in / sign up overlay
```

To protect a new endpoint:

```python
from app.api.deps import get_current_user

@router.get("/notes")
def list_notes(user: User = Depends(get_current_user)):
    ...
```

## Known limitations

- **No password reset.** It needs an email provider. The plan: a
  `password_resets` table storing a hashed, single-use token that expires
  after ~30 minutes; a "check your email" response that's the same whether or
  not the account exists; and all of the user's sessions ended once the
  password changes.
- **No email verification.**
- **Rate limits are per process.** They live in memory, so they reset on
  restart and aren't shared between workers. Move to Redis if we run more
  than one instance.
- **Behind a reverse proxy**, run uvicorn with `--proxy-headers` and
  `--forwarded-allow-ips` set to the proxy's address. Otherwise every request
  looks like it comes from the proxy, and everyone shares one rate limit.
- Expired session rows are deleted when they're next used, not on a schedule.
  Add a periodic cleanup if the table grows.

## Production checklist

- [ ] `ENVIRONMENT=production` and `COOKIE_SECURE=true` (the app won't start without it)
- [ ] Serve everything over HTTPS
- [ ] Frontend and API on the same site, with `/api` reverse-proxied to uvicorn
- [ ] `CORS_ORIGINS` set to the real frontend origin only
- [ ] A real database (e.g. Postgres) in `DATABASE_URL`, separate from dev
- [ ] `alembic upgrade head` run as part of each deploy
- [ ] uvicorn started with `--proxy-headers --forwarded-allow-ips=<proxy ip>`
- [ ] `/api/health` wired to the platform's health check
- [ ] `.env` files and secrets kept out of git (already in `.gitignore`)
