"""Auth router — Google OAuth, email/password, guest pass."""

import base64
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.database import get_pool
from app.core.middleware import (
    AUTH_FLAG_COOKIE,
    SESSION_COOKIE,
    _SAMESITE,
    _SECURE_COOKIES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


def _sign_token(data: dict, secret: str, ttl: int = 60) -> str:
    payload = json.dumps({**data, "exp": int(time.time()) + ttl})
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def _verify_token(token: str, secret: str) -> dict | None:
    try:
        decoded = base64.urlsafe_b64decode(token).decode()
        payload_str, sig = decoded.rsplit("|", 1)
        expected = hmac.new(
            secret.encode(), payload_str.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(payload_str)
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def _hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    import bcrypt

    return bcrypt.checkpw(password.encode(), hashed.encode())


async def _upsert_user(
    email: str,
    name: str,
    picture: str = "",
    password_hash: str | None = None,
    provider: str = "email",
) -> dict:
    """Create or update user — merges OAuth and email accounts by email address."""
    pool = get_pool()
    if not pool:
        return {"email": email, "name": name, "picture": picture}

    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM users WHERE email = $1", email)

        if existing:
            new_provider = existing["provider"]
            if provider != existing["provider"] and existing["provider"] != "both":
                new_provider = "both"

            new_name = name or existing["name"]
            new_picture = picture or existing["picture"] or ""

            if password_hash and not existing["password_hash"]:
                await conn.execute(
                    """UPDATE users SET name=$1, picture=$2, provider=$3,
                       password_hash=$4, updated_at=now() WHERE email=$5""",
                    new_name,
                    new_picture,
                    new_provider,
                    password_hash,
                    email,
                )
            else:
                await conn.execute(
                    """UPDATE users SET name=$1, picture=$2, provider=$3,
                       updated_at=now() WHERE email=$4""",
                    new_name,
                    new_picture,
                    new_provider,
                    email,
                )

            return {
                "id": str(existing["id"]),
                "email": email,
                "name": new_name,
                "picture": new_picture,
            }
        else:
            row = await conn.fetchrow(
                """INSERT INTO users (email, name, picture, password_hash, provider)
                   VALUES ($1, $2, $3, $4, $5) RETURNING id""",
                email,
                name,
                picture,
                password_hash,
                provider,
            )
            return {
                "id": str(row["id"]),
                "email": email,
                "name": name,
                "picture": picture,
            }


def _store_session(session_id: str, user_data: dict, response):
    settings = get_settings()
    session_payload = {
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "picture": user_data.get("picture", ""),
        "authenticated": True,
    }

    try:
        from app.services.history_service import get_redis

        redis = get_redis()
        if redis:
            redis.setex(
                f"session:{session_id}",
                settings.REDIS_TTL,
                json.dumps(session_payload),
            )
    except Exception as exc:
        logger.warning("redis session store failed: %s", exc)

    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        httponly=True,
        samesite=_SAMESITE,
        max_age=settings.REDIS_TTL,
        secure=_SECURE_COOKIES,
    )
    response.set_cookie(
        AUTH_FLAG_COOKIE,
        "1",
        httponly=False,
        samesite=_SAMESITE,
        max_age=settings.REDIS_TTL,
        secure=_SECURE_COOKIES,
    )


# --------------- email/password auth ---------------


class SignupRequest(BaseModel):
    email: str = Field(..., min_length=3, examples=["user@example.com"])
    name: str = Field(..., min_length=1, examples=["Jane Doe"])
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, examples=["user@example.com"])
    password: str = Field(..., min_length=1)


@router.post("/signup", summary="Create account with email and password")
async def signup(body: SignupRequest):
    settings = get_settings()
    pool = get_pool()

    if pool:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT password_hash FROM users WHERE email = $1", body.email
            )
            if existing and existing["password_hash"]:
                raise HTTPException(
                    status_code=409,
                    detail="Account already exists — try logging in",
                )

    password_hash = _hash_password(body.password)
    user_data = await _upsert_user(
        body.email, body.name, password_hash=password_hash, provider="email"
    )

    session_id = str(uuid4())
    session_token = _sign_token(
        {
            "session_id": session_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture", ""),
            "authenticated": True,
        },
        settings.SESSION_SECRET,
        ttl=86400,
    )
    response = JSONResponse(
        {
            "message": "Account created",
            "user": {
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture", ""),
            },
            "session_token": session_token,
        },
        status_code=201,
    )
    _store_session(session_id, user_data, response)
    return response


@router.post("/login", summary="Login with email and password")
async def login_email(body: LoginRequest):
    settings = get_settings()
    pool = get_pool()

    if not pool:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable — use Google sign-in instead",
        )

    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE email = $1", body.email)

    if not user or not user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_data = {
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "picture": user["picture"] or "",
    }

    session_id = str(uuid4())
    session_token = _sign_token(
        {
            "session_id": session_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture", ""),
            "authenticated": True,
        },
        settings.SESSION_SECRET,
        ttl=86400,
    )
    response = JSONResponse(
        {
            "message": "Login successful",
            "user": user_data,
            "session_token": session_token,
        }
    )
    _store_session(session_id, user_data, response)
    return response


# --------------- domain guest pass ---------------


class GuestPassRequest(BaseModel):
    email: str = Field(..., min_length=5, examples=["reviewer@pawait.co.ke"])


@router.post("/guest-pass", summary="Frictionless access for whitelisted domains")
async def guest_pass(body: GuestPassRequest):
    """60-minute session for @pawait.co.ke employees — no signup required."""
    settings = get_settings()

    domain = body.email.rsplit("@", 1)[-1].lower() if "@" in body.email else ""
    if domain not in settings.GUEST_PASS_DOMAINS:
        raise HTTPException(
            status_code=403,
            detail=f"Guest pass is only available for {', '.join(settings.GUEST_PASS_DOMAINS)} email addresses",
        )

    user_data = await _upsert_user(
        email=body.email,
        name=body.email.split("@")[0].replace(".", " ").title(),
        provider="guest_pass",
    )

    session_id = str(uuid4())
    session_payload = {
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "picture": user_data.get("picture", ""),
        "authenticated": True,
        "guest_pass": True,
    }

    try:
        from app.services.history_service import get_redis

        redis = get_redis()
        if redis:
            redis.setex(
                f"session:{session_id}",
                settings.GUEST_PASS_TTL,
                json.dumps(session_payload),
            )
    except Exception as exc:
        logger.warning("redis guest-pass session failed: %s", exc)

    session_token = _sign_token(
        {"session_id": session_id, **session_payload},
        settings.SESSION_SECRET,
        ttl=settings.GUEST_PASS_TTL,
    )
    response = JSONResponse(
        {
            "message": "Guest pass activated — 60 minute session",
            "user": {
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture", ""),
            },
            "ttl_minutes": settings.GUEST_PASS_TTL // 60,
            "session_token": session_token,
        }
    )
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        httponly=True,
        samesite=_SAMESITE,
        max_age=settings.GUEST_PASS_TTL,
        secure=_SECURE_COOKIES,
    )
    response.set_cookie(
        AUTH_FLAG_COOKIE,
        "1",
        httponly=False,
        samesite=_SAMESITE,
        max_age=settings.GUEST_PASS_TTL,
        secure=_SECURE_COOKIES,
    )
    return response


# --------------- Google OAuth ---------------


@router.get("/login", summary="Redirect to Google OAuth consent")
async def login_oauth():
    settings = get_settings()

    if not settings.GOOGLE_CLIENT_ID:
        return {"error": "OAuth not configured — set GOOGLE_CLIENT_ID in .env"}

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }

    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/callback", summary="OAuth callback — exchanges code for session")
async def callback(code: str, request: Request):
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

        if token_resp.status_code != 200:
            logger.error("token exchange failed: %s", token_resp.text[:200])
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=oauth_failed")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")

        user_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=oauth_failed")

        user_info = user_resp.json()

    user_data = await _upsert_user(
        email=user_info.get("email", ""),
        name=user_info.get("name", ""),
        picture=user_info.get("picture", ""),
        provider="google",
    )

    # cross-site redirects drop Set-Cookie, so we pass a signed token
    # and let the frontend exchange it via fetch() instead
    session_id = str(uuid4())
    token_payload = {
        "session_id": session_id,
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "picture": user_data.get("picture", ""),
        "authenticated": True,
    }
    token = _sign_token(token_payload, settings.SESSION_SECRET, ttl=120)

    return RedirectResponse(f"{settings.FRONTEND_URL}?auth=token&token={token}")


@router.post("/exchange", summary="Exchange OAuth token for session cookie")
async def exchange_token(request: Request):
    settings = get_settings()
    body = await request.json()
    token = body.get("token", "")

    payload = _verify_token(token, settings.SESSION_SECRET)
    if not payload:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    payload.pop("exp", None)
    session_id = payload.pop("session_id")

    # long-lived bearer token so frontend doesn't depend on cross-origin cookies
    session_token = _sign_token(
        {**payload, "session_id": session_id},
        settings.SESSION_SECRET,
        ttl=86400,
    )

    response = JSONResponse({**payload, "session_token": session_token})
    _store_session(session_id, payload, response)
    return response


# --------------- session ---------------


@router.get("/me", summary="Current user info")
async def me(request: Request):
    user = getattr(request.state, "user", None)
    if user and user.get("authenticated"):
        return user
    return {"authenticated": False}


@router.post("/logout", summary="Clear session")
async def logout(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)

    if session_id:
        try:
            from app.services.history_service import get_redis

            redis = get_redis()
            if redis:
                redis.delete(f"session:{session_id}")
        except Exception:
            pass

    resp = JSONResponse({"message": "logged out"})
    resp.delete_cookie(SESSION_COOKIE)
    resp.delete_cookie(AUTH_FLAG_COOKIE)
    return resp
