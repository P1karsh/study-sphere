import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db, make_engine
from app.main import app
from app.utils.rate_limit import login_limiter, register_limiter


@pytest.fixture
def db_session_factory(tmp_path):
    # A fresh SQLite file per test, so tests never see each other's users.
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def client(db_session_factory):
    def override_get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    login_limiter.reset()
    register_limiter.reset()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def new_user():
    return {"name": "Ada Lovelace", "email": "ada@example.com", "password": "analytical-engine"}


@pytest.fixture
def registered(client, new_user):
    """A client that has signed up (and is therefore signed in)."""
    response = client.post("/api/auth/register", json=new_user)
    assert response.status_code == 201
    return client
