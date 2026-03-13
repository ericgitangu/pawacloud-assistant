"""Session middleware — attaches session_id + user to request.state."""

import json
import logging
import os
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

_SECURE_COOKIES = bool(os.environ.get("FLY_APP_NAME") or os.environ.get("K_SERVICE"))
_SAMESITE = "none" if _SECURE_COOKIES else "lax"

SESSION_COOKIE = "pawacloud_sid"
AUTH_FLAG_COOKIE = "pawacloud_auth"


class SessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        session_id = None
        user = None

        # Bearer token takes priority — works cross-origin without cookies
        user, session_id = self._load_from_bearer(request)

        # fall back to cookie-based session
        if not user:
            cookie_sid = request.cookies.get(SESSION_COOKIE)
            if cookie_sid:
                session_id = cookie_sid
                user = await self._load_from_redis(cookie_sid)
                if not user and AUTH_FLAG_COOKIE in request.cookies:
                    user = {"authenticated": True, "name": "", "email": ""}

        if not session_id:
            session_id = str(uuid4())

        request.state.session_id = session_id
        request.state.user = user

        response: Response = await call_next(request)

        if SESSION_COOKIE not in request.cookies:
            already_set = any(
                SESSION_COOKIE in h for h in response.headers.getlist("set-cookie")
            )
            if not already_set:
                response.set_cookie(
                    SESSION_COOKIE,
                    session_id,
                    httponly=True,
                    samesite=_SAMESITE,
                    max_age=86400,
                    secure=_SECURE_COOKIES,
                )

        return response

    def _load_from_bearer(self, request: Request) -> tuple[dict | None, str | None]:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None, None

        try:
            from app.routers.auth import _verify_token
            from app.core.config import get_settings

            token = auth[7:]
            payload = _verify_token(token, get_settings().SESSION_SECRET)
            if not payload:
                return None, None

            session_id = payload.pop("session_id", str(uuid4()))
            payload.pop("exp", None)
            return payload, session_id
        except Exception as exc:
            logger.debug("bearer token decode failed: %s", exc)
            return None, None

    async def _load_from_redis(self, session_id: str):
        try:
            from app.services.history_service import get_redis

            redis = get_redis()
            if redis is None:
                return None

            raw = redis.get(f"session:{session_id}")
            if raw:
                return json.loads(raw)
        except Exception as exc:
            logger.debug("session load failed (non-critical): %s", exc)
        return None
