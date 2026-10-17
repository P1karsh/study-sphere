from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.core import passwords
from app.models import User, UserSession

COOKIE = "studysphere_session"


# --- registration -----------------------------------------------------------


def test_register_creates_user_and_signs_them_in(client, new_user):
    response = client.post("/api/auth/register", json=new_user)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Ada Lovelace"
    assert body["email"] == "ada@example.com"
    assert set(body) == {"id", "name", "email", "created_at"}

    cookie_header = response.headers["set-cookie"]
    assert COOKIE in cookie_header
    assert "HttpOnly" in cookie_header
    assert "samesite=lax" in cookie_header.lower()

    assert client.get("/api/auth/me").json()["email"] == "ada@example.com"


def test_register_normalises_email_and_name(client):
    response = client.post(
        "/api/auth/register",
        json={"name": "  Ada   Lovelace ", "email": "  Ada@Example.COM ", "password": "12345678"},
    )
    assert response.status_code == 201
    assert response.json()["email"] == "ada@example.com"
    assert response.json()["name"] == "Ada Lovelace"


def test_password_is_stored_hashed(client, new_user, db_session_factory):
    client.post("/api/auth/register", json=new_user)

    with db_session_factory() as db:
        user = db.scalar(select(User))

    assert user.password_hash != new_user["password"]
    assert user.password_hash.startswith("$argon2id$")
    assert passwords.verify_password(user.password_hash, new_user["password"])
    assert not passwords.verify_password(user.password_hash, "wrong-password")


def test_duplicate_email_is_rejected_case_insensitively(registered, new_user):
    response = registered.post(
        "/api/auth/register", json={**new_user, "email": "ADA@example.com"}
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists"


def test_database_enforces_unique_email(db_session_factory):
    with db_session_factory() as db:
        db.add(User(name="One", email="same@example.com", password_hash="x"))
        db.commit()
        db.add(User(name="Two", email="same@example.com", password_hash="y"))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.parametrize(
    "payload, message",
    [
        ({"email": "a@example.com", "password": "12345678"}, "Name is required"),
        ({"name": "Ada", "password": "12345678"}, "Email is required"),
        ({"name": "Ada", "email": "a@example.com"}, "Password is required"),
        ({"name": "   ", "email": "a@example.com", "password": "12345678"}, "Please enter your name"),
        ({"name": "Ada", "email": "not-an-email", "password": "12345678"}, "Please enter a valid email address"),
        ({"name": "Ada", "email": "a@example.com", "password": "short"}, "Password must be at least 8 characters"),
        ({"name": "Ada", "email": "a@example.com", "password": "x" * 129}, "Password must be 128 characters or fewer"),
        ({"name": "Ada", "email": "a@example.com", "password": " " * 10}, "Password can't be only spaces"),
        ({"name": "A" * 101, "email": "a@example.com", "password": "12345678"}, "Name must be 100 characters or fewer"),
    ],
)
def test_register_validation(client, payload, message):
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"] == message


# --- login ------------------------------------------------------------------


def test_login_with_correct_password(registered, new_user):
    registered.post("/api/auth/logout")

    response = registered.post(
        "/api/auth/login",
        json={"email": "  ADA@example.com", "password": new_user["password"]},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"
    assert "password_hash" not in response.json()
    assert registered.get("/api/auth/me").status_code == 200


def test_wrong_password_and_unknown_email_look_the_same(registered, new_user):
    registered.post("/api/auth/logout")

    wrong_password = registered.post(
        "/api/auth/login", json={"email": new_user["email"], "password": "not-it-at-all"}
    )
    unknown_email = registered.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "whatever123"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json() == {"detail": "Invalid email or password"}
    assert registered.get("/api/auth/me").status_code == 401


def test_login_requires_both_fields(client):
    assert client.post("/api/auth/login", json={"email": "a@example.com"}).status_code == 422
    assert client.post("/api/auth/login", json={"password": "12345678"}).status_code == 422
    assert client.post("/api/auth/login", json={"email": "", "password": ""}).status_code == 422


def test_login_is_rate_limited(client):
    attempt = {"email": "nobody@example.com", "password": "whatever123"}
    for _ in range(10):
        assert client.post("/api/auth/login", json=attempt).status_code == 401

    response = client.post("/api/auth/login", json=attempt)
    assert response.status_code == 429
    assert "Retry-After" in response.headers


# --- current user, logout and sessions ---------------------------------------


def test_me_requires_a_session(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Not signed in"}


def test_made_up_session_cookie_is_rejected(client):
    client.cookies.set(COOKIE, "definitely-not-a-real-token")
    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session_on_the_server(registered, db_session_factory):
    old_token = registered.cookies.get(COOKIE)

    response = registered.post("/api/auth/logout")
    assert response.status_code == 204
    assert registered.get("/api/auth/me").status_code == 401

    # Replaying the old cookie must not work either - the session row is gone.
    registered.cookies.set(COOKIE, old_token)
    assert registered.get("/api/auth/me").status_code == 401
    with db_session_factory() as db:
        assert db.scalar(select(UserSession)) is None


def test_logout_without_a_session_is_harmless(client):
    assert client.post("/api/auth/logout").status_code == 204


def test_expired_session_is_rejected_and_removed(registered, db_session_factory):
    with db_session_factory() as db:
        db.execute(
            update(UserSession).values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
        db.commit()

    assert registered.get("/api/auth/me").status_code == 401
    with db_session_factory() as db:
        assert db.scalar(select(UserSession)) is None


def test_session_token_is_not_stored_in_plain_text(registered, db_session_factory):
    token = registered.cookies.get(COOKIE)
    with db_session_factory() as db:
        stored = db.scalar(select(UserSession))
    assert stored.token_hash != token
    assert len(stored.token_hash) == 64


# --- request guards ----------------------------------------------------------


def test_posts_from_unknown_origins_are_blocked(client, new_user):
    response = client.post(
        "/api/auth/register", json=new_user, headers={"Origin": "https://evil.example"}
    )
    assert response.status_code == 403


def test_posts_from_the_frontend_origin_are_allowed(client, new_user):
    response = client.post(
        "/api/auth/register", json=new_user, headers={"Origin": "http://localhost:5173"}
    )
    assert response.status_code == 201


def test_oversized_bodies_are_rejected(client):
    response = client.post(
        "/api/auth/login",
        content=b"x" * (65 * 1024),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
