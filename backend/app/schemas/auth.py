from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

MIN_PASSWORD_LENGTH = 8
# Long enough for any passphrase, short enough that nobody can make us hash
# a megabyte of text.
MAX_PASSWORD_LENGTH = 128
MAX_EMAIL_LENGTH = 254


def _normalise_email(value: str) -> str:
    return value.strip().lower()


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Please enter your name")
        if len(value) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return value

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value):
        if isinstance(value, str):
            value = _normalise_email(value)
            if len(value) > MAX_EMAIL_LENGTH:
                raise ValueError("Email address is too long")
        return value

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        # EmailStr only lowercases the domain part; we want the whole thing.
        return value.lower()

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
        if len(value) > MAX_PASSWORD_LENGTH:
            raise ValueError(f"Password must be {MAX_PASSWORD_LENGTH} characters or fewer")
        if not value.strip():
            raise ValueError("Password can't be only spaces")
        return value


class LoginRequest(BaseModel):
    # No format check here: a malformed email just won't match anyone, and we
    # give the same "invalid email or password" answer either way.
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = _normalise_email(value)
        if not value or len(value) > MAX_EMAIL_LENGTH:
            raise ValueError("Please enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if not value or len(value) > MAX_PASSWORD_LENGTH:
            raise ValueError("Please enter your password")
        return value


class UserOut(BaseModel):
    """What the frontend gets to see about a user. Never add password_hash here."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def assume_utc(cls, value: datetime) -> datetime:
        # SQLite drops the timezone on the way out; everything we store is UTC.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
