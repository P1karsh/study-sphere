from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models import User
from app.services.sessions import find_user_for_token


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Add this as a dependency to any route that needs a signed-in user."""
    token = request.cookies.get(get_settings().session_cookie_name)
    user = find_user_for_token(db, token) if token else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return user
