import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import User, UserSession


def _hash_token(token: str) -> str:
    # The raw token only ever lives in the user's cookie. If the database
    # leaks, the stored hashes can't be replayed as cookies.
    return hashlib.sha256(token.encode()).hexdigest()


def _as_utc(moment: datetime) -> datetime:
    # SQLite hands datetimes back without a timezone even though we store UTC.
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def start_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    ttl = timedelta(hours=get_settings().session_ttl_hours)
    db.add(
        UserSession(
            token_hash=_hash_token(token),
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + ttl,
        )
    )
    db.commit()
    return token


def find_user_for_token(db: Session, token: str) -> User | None:
    session = db.scalar(select(UserSession).where(UserSession.token_hash == _hash_token(token)))
    if session is None:
        return None

    if _as_utc(session.expires_at) <= datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        return None

    return session.user


def end_session(db: Session, token: str) -> None:
    db.execute(delete(UserSession).where(UserSession.token_hash == _hash_token(token)))
    db.commit()


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
