from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2id with the library's recommended defaults (RFC 9106).
_hasher = PasswordHasher()

# Used when someone tries to log in with an email we don't know. Verifying
# against a throwaway hash means that path takes about as long as a real
# wrong-password check, so response times don't reveal which emails exist.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def burn_time_verifying(password: str) -> None:
    verify_password(_DUMMY_HASH, password)


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)
