"""PawaCloud Assistant API — FastAPI backend."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.core.config import get_settings
from app.core.database import close_db, init_db
from app.core.middleware import SessionMiddleware
from app.routers import auth, chat, health
from app.services.text_processing import RUST_AVAILABLE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"pawacloud api starting — rust native: {RUST_AVAILABLE}")
    await init_db()
    yield
    await close_db()
    logger.info("shutting down")


settings = get_settings()

app = FastAPI(
    title=settings.APP_TITLE,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,  # custom route below — default uses unstable @next CDN tag
    openapi_tags=[
        {"name": "Chat", "description": "Q&A with Gemini LLM — sync and streaming"},
        {"name": "Health", "description": "Service health and metadata"},
        {
            "name": "Auth",
            "description": "Google OAuth, email/password, and guest pass authentication",
        },
    ],
    swagger_ui_parameters={"defaultModelsExpandDepth": -1},
)

# CORS — assessment spec says disregard security
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return HTMLResponse("""<!DOCTYPE html>
<html><head>
<title>PawaCloud Assistant API — ReDoc</title>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
<style>body { margin: 0; padding: 0; }</style>
</head><body>
<redoc spec-url="/openapi.json"></redoc>
<script src="https://cdn.redoc.ly/redoc/v2.1.5/bundles/redoc.standalone.js"></script>
</body></html>""")


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
