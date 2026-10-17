import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    """
    Very small sliding-window limiter, keyed by client IP.

    It lives in process memory, so limits reset on restart and aren't shared
    between multiple server processes. That's fine for a single instance;
    swap in something Redis-backed if we ever run several.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = self._hits[key]

        while hits and hits[0] <= now - self.window_seconds:
            hits.popleft()

        if len(hits) >= self.max_requests:
            retry_after = int(hits[0] + self.window_seconds - now) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a few minutes and try again.",
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()


login_limiter = RateLimiter(max_requests=10, window_seconds=5 * 60)
register_limiter = RateLimiter(max_requests=10, window_seconds=60 * 60)
