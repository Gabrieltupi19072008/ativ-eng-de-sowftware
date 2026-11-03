import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Response

import config

_hasher = PasswordHasher()
# Hash de uma senha qualquer: usado para gastar o mesmo tempo quando o e-mail não existe.
_DUMMY_HASH = _hasher.hash("senha-que-nunca-sera-usada")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(hours=config.JWT_HOURS)}
    return jwt.encode(payload, config.jwt_secret(), algorithm="HS256")


def read_token(token: str | None) -> int | None:
    if not token:
        return None
    try:
        data = jwt.decode(token, config.jwt_secret(), algorithms=["HS256"], options={"require": ["exp", "sub"]})
        return int(data["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        config.COOKIE_NAME,
        create_token(user_id),
        max_age=config.JWT_HOURS * 3600,
        httponly=True,  # o JavaScript do navegador não consegue ler o cookie
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(config.COOKIE_NAME, path="/", samesite=config.COOKIE_SAMESITE, secure=config.COOKIE_SECURE)


class LoginLimiter:
    """Bloqueia tentativas em excesso por e-mail. Fica na memória do processo (suficiente para um servidor só)."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 15 * 60):
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        attempts = self._failures[key]
        limit = time.monotonic() - self.window
        while attempts and attempts[0] < limit:
            attempts.popleft()
        return attempts

    def blocked(self, key: str) -> bool:
        return len(self._recent(key)) >= self.max_attempts

    def fail(self, key: str) -> None:
        self._recent(key).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def clear_all(self) -> None:
        self._failures.clear()


login_limiter = LoginLimiter()
