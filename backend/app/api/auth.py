from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core import passwords
from app.core.config import get_settings
from app.db.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserOut
from app.services.sessions import (
    clear_session_cookie,
    end_session,
    set_session_cookie,
    start_session,
)
from app.utils.rate_limit import login_limiter, register_limiter

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_TAKEN = "An account with this email already exists"
BAD_CREDENTIALS = "Invalid email or password"


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_limiter)],
)
def register(body: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=EMAIL_TAKEN)

    user = User(
        name=body.name,
        email=body.email,
        password_hash=passwords.hash_password(body.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two sign-ups with the same email raced past the check above.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail=EMAIL_TAKEN)

    # Signing up also signs you in.
    set_session_cookie(response, start_session(db, user))
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(login_limiter)])
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))

    if user is None:
        passwords.burn_time_verifying(body.password)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=BAD_CREDENTIALS)

    if not passwords.verify_password(user.password_hash, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=BAD_CREDENTIALS)

    # If argon2's recommended settings change, quietly upgrade the stored hash.
    if passwords.needs_rehash(user.password_hash):
        user.password_hash = passwords.hash_password(body.password)
        db.commit()

    set_session_cookie(response, start_session(db, user))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    # Always succeeds, even if the session was already gone.
    token = request.cookies.get(get_settings().session_cookie_name)
    if token:
        end_session(db, token)
    clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
