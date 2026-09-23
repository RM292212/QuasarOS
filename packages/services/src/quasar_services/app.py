"""
QuasarOS FastAPI Application Entrypoint.

Configures global exception handlers according to docs/02-architecture/ErrorModel.md,
CORS policies, security headers, request size limits, tracing & latency middleware,
and mounts routers.
"""

import logging
import os
from pathlib import Path
import time
from typing import List, Optional
import uuid
from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from quasar_services.catalog.errors import (
    CatalogServiceException,
    QuasarErrorDetail,
    QuasarErrorResponse,
)
from quasar_services.catalog.router import router as catalog_router
from quasar_services.query.router import router as query_router
from quasar_services.analysis.router import router as analysis_router

# Logging Configuration
LOG_LEVEL = os.environ.get("QUASAR_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
logger = logging.getLogger("quasar.services")

# Environment Configuration
DEFAULT_MAX_REQUEST_BYTES = 10 * 1024 * 1024  # 10 MiB limit
MAX_REQUEST_BYTES = int(os.environ.get("QUASAR_MAX_REQUEST_BYTES", DEFAULT_MAX_REQUEST_BYTES))
CORS_ORIGINS_RAW = os.environ.get("QUASAR_CORS_ORIGINS", "*")
CORS_ORIGINS: List[str] = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()] or ["*"]


def create_app(static_dir: Optional[Path] = None) -> FastAPI:
    app = FastAPI(
        title="QuasarOS Scientific Catalog & Visualization API",
        description="High-performance control-plane, metadata catalog, and authoritative exact-value query service for QuasarOceanScope.",
        version="1.0.0",
        docs_url="/api/v1/docs",
        openapi_url="/api/v1/openapi.json",
    )

    # Enable CORS for browser front-ends (Vite / React / Cesium / Babylon)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "X-Response-Time-Ms",
            "X-Payload-SHA256",
            "ETag",
            "Content-Length",
            "x-volume-metadata",
            "x-trace-id",
            "x-generation",
        ],
    )

    # Tracing, Latency, and Security Headers Middleware
    @app.middleware("http")
    async def request_lifecycle_and_security_middleware(request: Request, call_next):
        start_time = time.perf_counter()
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = req_id

        # 1. Request Size Validation (Prevent denial-of-service via oversized payloads)
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length_int = int(content_length)
                if length_int > MAX_REQUEST_BYTES:
                    error_payload = QuasarErrorResponse(
                        error=QuasarErrorDetail(
                            code="VALIDATION_PAYLOAD_TOO_LARGE",
                            message=f"Request entity size ({length_int} bytes) exceeds maximum permitted limit ({MAX_REQUEST_BYTES} bytes).",
                            requestId=req_id,
                            retryable=False,
                            details={"maxBytes": MAX_REQUEST_BYTES, "receivedBytes": length_int},
                        )
                    )
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content=error_payload.model_dump(),
                    )
            except ValueError:
                pass

        # 2. Execute inner route / handler
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        # 3. Add Diagnostic & Tracing Headers
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"

        # 4. Enforce Strict Operational Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' http: https: ws: wss:; "
            "worker-src 'self' blob:; "
            "object-src 'none'; "
            "frame-ancestors 'none';"
        )

        return response

    # Exception Handlers conforming to ErrorModel.md
    @app.exception_handler(CatalogServiceException)
    async def handle_domain_exception(request: Request, exc: CatalogServiceException):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        payload = QuasarErrorResponse(
            error=QuasarErrorDetail(
                code=exc.code,
                message=exc.message,
                requestId=req_id,
                retryable=exc.retryable,
                details=exc.details,
            )
        )
        return JSONResponse(status_code=exc.status_code, content=payload.model_dump())

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(request: Request, exc: RequestValidationError):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        safe_errors = [
            {"loc": [str(l) for l in err.get("loc", [])], "msg": err.get("msg"), "type": err.get("type")}
            for err in exc.errors()
        ]
        payload = QuasarErrorResponse(
            error=QuasarErrorDetail(
                code="VALIDATION_SCHEMA_VIOLATION",
                message="The request payload or parameters failed schema validation.",
                requestId=req_id,
                retryable=False,
                details={"validationErrors": safe_errors},
            )
        )
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=payload.model_dump())

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(request: Request, exc: Exception):
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        payload = QuasarErrorResponse(
            error=QuasarErrorDetail(
                code="INTERNAL_UNEXPECTED",
                message="An unexpected server failure occurred.",
                requestId=req_id,
                retryable=False,
                details={},
            )
        )
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload.model_dump())

    # Include REST routers
    app.include_router(catalog_router)
    app.include_router(query_router)
    app.include_router(analysis_router)

    # Static Asset Delivery for apps/web/ UI if configured or present
    static_asset_path = static_dir or os.environ.get("QUASAR_STATIC_DIR")
    if static_asset_path:
        resolved_static = Path(static_asset_path).resolve()
        if resolved_static.exists() and resolved_static.is_dir():
            app.mount("/assets", StaticFiles(directory=str(resolved_static / "assets")), name="static-assets") if (resolved_static / "assets").exists() else None
            
            @app.get("/{full_path:path}", include_in_schema=False)
            async def serve_spa_frontend(full_path: str):
                target = (resolved_static / full_path).resolve()
                if target.is_file() and target.exists() and resolved_static in target.parents:
                    return FileResponse(str(target))
                index_file = resolved_static / "index.html"
                if index_file.exists():
                    return FileResponse(str(index_file))
                return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Not Found"})

    return app


app = create_app()




