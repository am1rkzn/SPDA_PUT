import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from time import perf_counter
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, Header, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from opentelemetry.trace import SpanKind, Status, StatusCode
from pydantic import BaseModel, Field

from . import db
from .telemetry import Telemetry, request_id


@asynccontextmanager
async def lifespan(app):
    db.initialize()
    app.state.tel = Telemetry()
    try:
        yield
    finally:
        app.state.tel.close()


app = FastAPI(title="ПУТЬ", lifespan=lifespan)


def error(status, code, message):
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


@app.exception_handler(db.Problem)
async def problem_handler(request, exc):
    return error(exc.status, exc.code, str(exc))


@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    fields = ", ".join(".".join(map(str, item["loc"])) for item in exc.errors())
    return error(422, "VALIDATION", f"Проверьте параметры запроса: {fields}")


@app.exception_handler(sqlite3.OperationalError)
async def database_handler(request, exc):
    app.state.tel.log.error("database_error", extra={"request_id": request_id.get(),
                            "sqlite_error": getattr(exc, "sqlite_errorname", "unknown")})
    return error(503, "DB_UNAVAILABLE", "База данных временно недоступна")


@app.middleware("http")
async def observe(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)
    tel = app.state.tel
    rid = str(uuid4())
    token = request_id.set(rid)
    start = perf_counter()
    try:
        with tel.tracer.start_as_current_span("HTTP request", kind=SpanKind.SERVER) as span:
            try:
                response = await call_next(request)
            except Exception as exc:
                tel.log.error("internal_error", extra={"error_type": type(exc).__name__, "request_id": rid})
                response = error(500, "INTERNAL", "Внутренняя ошибка сервера")
            route = getattr(request.scope.get("route"), "path", None) or "unmatched"
            elapsed = (perf_counter() - start) * 1000
            attrs = {"route": route, "method": request.method, "status": response.status_code}
            span.update_name(f"{request.method} {route}")
            span.set_attributes(attrs)
            if response.status_code >= 500:
                span.set_status(Status(StatusCode.ERROR))
            tel.requests.add(1, attrs)
            tel.duration.record(elapsed, attrs)
            tel.log.info("http_request", extra={**attrs, "request_id": rid, "duration_ms": elapsed})
            response.headers["X-Request-ID"] = rid
            return response
    finally:
        request_id.reset(token)


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/readyz")
def ready():
    try:
        with db.connection() as conn:
            ok = (conn.execute("PRAGMA user_version").fetchone()[0] == 1 and
                  conn.execute("SELECT 1 FROM users WHERE id=?", (db.USER,)).fetchone())
    except sqlite3.Error:
        ok = False
    return {"status": "ready"} if ok else error(503, "DB_UNAVAILABLE", "БД не готова")


@app.get("/api/routes")
def list_routes(trip_type: Literal["любой", "туристический", "активный", "спокойный"] | None = None,
                max_duration: Annotated[int | None, Query(gt=0)] = None, tags: str = ""):
    tel = app.state.tel
    with tel.tracer.start_as_current_span("catalog.recommend"), db.connection() as conn:
        cards = db.list_routes(conn, trip_type, max_duration, tags)
    tel.event("routes_requested")
    if not cards:
        tel.event("routes_empty")
    return cards


@app.get("/api/routes/{id}")
def route(id: str):
    with db.connection() as conn:
        return db.get_route(conn, id)


@app.get("/api/bikes")
def bikes():
    with db.connection() as conn:
        return db.list_bikes(conn)


@app.get("/api/rental")
def current(response: Response):
    response.headers["Cache-Control"] = "no-store"
    with db.connection() as conn:
        return db.active(conn)


class Start(BaseModel):
    bike_id: str = Field(min_length=1)
    route_id: str = Field(min_length=1)


class Finish(BaseModel):
    rental_id: UUID


@app.post("/api/rental", status_code=201, responses={200: {"description": "Повтор команды"}})
def start(body: Start, response: Response, idempotency_key: Annotated[UUID, Header()]):
    tel = app.state.tel
    with tel.tracer.start_as_current_span("rental.start"), db.connection(write=True) as conn:
        rental, created = db.start(conn, body.bike_id, body.route_id, str(idempotency_key))
    if created:
        tel.event("rental_started")
    response.status_code = 201 if created else 200
    return rental


@app.post("/api/rental/finish", status_code=204)
def finish(body: Finish):
    tel = app.state.tel
    with tel.tracer.start_as_current_span("rental.finish"), db.connection(write=True) as conn:
        changed = db.finish(conn, str(body.rental_id))
    if changed:
        tel.event("rental_finished")
    return Response(status_code=204)


dist = Path(os.getenv("PUT_STATIC_DIR", Path(__file__).resolve().parents[1] / "frontend/dist"))
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
