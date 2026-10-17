from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Our requests are small JSON bodies. Anything bigger is a mistake or abuse.
MAX_BODY_BYTES = 64 * 1024


class RequestGuardMiddleware(BaseHTTPMiddleware):
    """
    Two cheap checks before a request reaches the routes:

    1. CSRF: the session cookie is SameSite=Lax, which already blocks most
       cross-site posts. On top of that, any state-changing request that
       carries an Origin header must come from one of our own frontends.
    2. Size: reject oversized bodies up front.
    """

    def __init__(self, app, allowed_origins: list[str]):
        super().__init__(app)
        self.allowed_origins = set(allowed_origins)

    async def dispatch(self, request: Request, call_next):
        if request.method in UNSAFE_METHODS:
            origin = request.headers.get("origin")
            if origin and origin not in self.allowed_origins:
                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)

        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request body too large"}, status_code=413)

        return await call_next(request)
