from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.core.config import get_settings
from app.core.security import RequestGuardMiddleware

settings = get_settings()

if settings.is_production and not settings.cookie_secure:
    raise RuntimeError("COOKIE_SECURE must be true in production (cookies need HTTPS).")

app = FastAPI(
    title="StudySphere API",
    # The interactive docs are handy locally but don't need to be public.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

app.add_middleware(RequestGuardMiddleware, allowed_origins=settings.cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def friendly_validation_errors(request: Request, exc: RequestValidationError):
    """
    Pydantic's default 422 body is a list of nested objects. The frontend just
    wants one sentence to show, so the first problem goes in `detail` and the
    full list stays under `errors`.
    """
    errors = exc.errors()
    message = "Some of the details you entered aren't valid"

    if errors:
        first = errors[0]
        field = first["loc"][-1] if first["loc"] else None
        if first["type"] == "missing":
            message = f"{str(field).capitalize()} is required"
        elif field == "email" and first["msg"].startswith("value is not a valid email"):
            message = "Please enter a valid email address"
        else:
            message = first["msg"].removeprefix("Value error, ")

    simple_errors = [
        {"field": e["loc"][-1] if e["loc"] else None, "message": e["msg"]} for e in errors
    ]
    return JSONResponse({"detail": message, "errors": simple_errors}, status_code=422)


app.include_router(auth_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "Welcome to StudySphere API 🚀"}
