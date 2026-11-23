import json
import os
import sqlite3
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

HERE = Path(__file__).parent
CATEGORIES = {"туристический", "активный", "спокойный"}
USER = "demo"

# Демонстрационный парк: точки рядом со стартами маршрутов каталога.
# Велосипед b1 ставится в точку старта подготовленного маршрута (см. seed).
BIKES = (
    ("b2", "Велосипед B", 49.1050, 55.7970),
    ("b3", "Велосипед C", 49.1247, 55.7931),
    ("b4", "Велосипед D", 49.1447, 55.8060),
    ("b5", "Велосипед E", 48.9635, 55.8379),
)
# Часть парка на старте уже арендована другими демопользователями,
# иначе в интерфейсе всегда виден только статус «свободен».
BUSY_RIDERS = {"b2": "demo-rider-1", "b4": "demo-rider-2"}


class Problem(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code = status, code


@contextmanager
def connection(*, initialize=False, write=False):
    path = Path(os.environ.get("PUT_DB_PATH", "put.sqlite")).resolve()
    mode = "rwc" if initialize else "rw"
    with closing(sqlite3.connect(f"{path.as_uri()}?mode={mode}", uri=True,
                                 timeout=3, isolation_level=None)) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        if write:
            conn.execute("BEGIN IMMEDIATE")
        with conn:
            yield conn


def seed_route(conn, route):
    def valid_point(point):
        return (len(point) == 2 and -180 <= point[0] <= 180 and -90 <= point[1] <= 90)

    geometry = route["geometry"]
    if not (route["durationMin"] > 0 and route["categories"] and
            set(route["categories"]) <= CATEGORIES and valid_point(route["start"]) and
            geometry["type"] == "LineString" and len(geometry["coordinates"]) >= 2 and
            all(valid_point(p) for p in geometry["coordinates"])):
        raise ValueError("Некорректные начальные данные маршрута")
    conn.execute("""INSERT INTO routes
        (id,title,description,categories_json,duration_min,tags_json,start_lon,start_lat,
         geometry_json,source,verified,photo,distance_km,landmarks_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
            categories_json=excluded.categories_json, duration_min=excluded.duration_min,
            tags_json=excluded.tags_json, start_lon=excluded.start_lon, start_lat=excluded.start_lat,
            geometry_json=excluded.geometry_json, source=excluded.source, verified=excluded.verified,
            photo=excluded.photo, distance_km=excluded.distance_km, landmarks_json=excluded.landmarks_json""",
        (route["id"], route["title"], route["description"], json.dumps(route["categories"]),
         route["durationMin"], json.dumps(route["tags"]), *route["start"], json.dumps(geometry),
         route["source"], route["verified"], route["photo"], route["_lengthKm"], json.dumps(route["landmarks"])))


def seed_fleet(conn, route):
    conn.execute("INSERT INTO users VALUES (?,?) ON CONFLICT(id) DO NOTHING",
                 (USER, "Демопользователь"))
    conn.execute("INSERT INTO bikes VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING",
                 ("b1", "Велосипед A", *route["start"]))
    for bike_id, label, lon, lat in BIKES:
        conn.execute("INSERT INTO bikes VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING",
                     (bike_id, label, lon, lat))
    for bike_id, rider in BUSY_RIDERS.items():
        conn.execute("INSERT INTO users VALUES (?,?) ON CONFLICT(id) DO NOTHING",
                     (rider, "Демопользователь в аренде"))
        busy = conn.execute("SELECT 1 FROM rentals WHERE bike_id=? AND ended_at IS NULL",
                            (bike_id,)).fetchone()
        if not busy:
            conn.execute("INSERT INTO rentals VALUES (?,?,?,?,?,NULL)",
                         (f"seed-{bike_id}", rider, bike_id, route["id"], now()))


def initialize():
    with connection(initialize=True, write=True) as conn:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        if version == 0:
            for statement in (HERE / "schema.sql").read_text("utf-8").split(";"):
                if statement.strip():
                    conn.execute(statement)
            version = 1
        if version == 1:
            conn.execute("ALTER TABLE routes ADD COLUMN photo TEXT")
            conn.execute("ALTER TABLE routes ADD COLUMN distance_km REAL")
            conn.execute("ALTER TABLE routes ADD COLUMN landmarks_json TEXT NOT NULL DEFAULT '[]'")
            conn.execute("PRAGMA user_version=2")
        elif version != 2:
            raise RuntimeError("Неизвестная версия схемы SQLite")
        catalog = HERE.parent / "Iteration_2" / "routes_kazan.json"
        routes = json.loads(catalog.read_text("utf-8"))
        for route in routes:
            if route["id"] == "r-les-kazani":
                route["id"] = "r1"  # Existing rentals reference this public ID.
            seed_route(conn, route)
        seed_fleet(conn, next(route for route in routes if route["id"] == "r1"))


def route_card(row):
    return dict(id=row["id"], title=row["title"], categories=json.loads(row["categories_json"]),
                durationMin=row["duration_min"], tags=json.loads(row["tags_json"]),
                start=[row["start_lon"], row["start_lat"]], photo=row["photo"])


def list_routes(conn, trip_type, max_duration, tags):
    wanted = {t.strip().lower() for t in tags.split(",") if t.strip()}
    matches = []
    for row in conn.execute("SELECT * FROM routes ORDER BY id"):
        card = route_card(row)
        if trip_type not in (None, "любой") and trip_type not in card["categories"]:
            continue
        if max_duration is not None and card["durationMin"] > max_duration:
            continue
        score = len(wanted.intersection(t.strip().lower() for t in card["tags"]))
        if not wanted or score:
            matches.append((score, card))
    return [card for _, card in sorted(matches, key=lambda item: -item[0])]


def required(row):
    if row is None:
        raise Problem(404, "NOT_FOUND", "Запрошенная запись не найдена")
    return row


def get_route(conn, route_id):
    row = required(conn.execute("SELECT * FROM routes WHERE id=?", (route_id,)).fetchone())
    return {**route_card(row), "description": row["description"],
            "distanceKm": row["distance_km"], "landmarks": json.loads(row["landmarks_json"]),
            "geometry": json.loads(row["geometry_json"]), "verified": bool(row["verified"])}


def list_bikes(conn):
    rows = conn.execute("""SELECT b.*, r.id AS rental FROM bikes b
        LEFT JOIN rentals r ON r.bike_id=b.id AND r.ended_at IS NULL ORDER BY b.id""")
    return [dict(id=r["id"], label=r["label"], coords=[r["lon"], r["lat"]],
                 status="busy" if r["rental"] else "available") for r in rows]


RENTAL = """SELECT r.id, r.bike_id AS bikeId, r.route_id AS routeId, r.started_at AS startedAt,
    b.label AS bikeLabel, t.title AS routeTitle FROM rentals r
    JOIN bikes b ON b.id=r.bike_id JOIN routes t ON t.id=r.route_id """


def active(conn):
    row = conn.execute(RENTAL + "WHERE r.user_id=? AND r.ended_at IS NULL", (USER,)).fetchone()
    return dict(row) if row else None


def now():
    return datetime.now(timezone.utc).isoformat()


def start(conn, bike, route, key):
    previous = conn.execute(RENTAL + """JOIN rental_start_requests c ON c.rental_id=r.id
        WHERE c.user_id=? AND c.request_key=?""", (USER, key)).fetchone()
    if previous:
        if (previous["bikeId"], previous["routeId"]) != (bike, route):
            raise Problem(409, "IDEMPOTENCY_CONFLICT", "Ключ уже использован для другой команды")
        return dict(previous), False

    required(conn.execute("SELECT 1 FROM bikes WHERE id=?", (bike,)).fetchone())
    required(conn.execute("SELECT 1 FROM routes WHERE id=?", (route,)).fetchone())
    rental = active(conn)
    created = rental is None
    if rental:
        if (rental["bikeId"], rental["routeId"]) != (bike, route):
            raise Problem(409, "RENTAL_ACTIVE", "Уже есть другая активная аренда")
    else:
        if conn.execute("SELECT 1 FROM rentals WHERE bike_id=? AND ended_at IS NULL", (bike,)).fetchone():
            raise Problem(409, "BIKE_BUSY", "Велосипед занят")
        conn.execute("INSERT INTO rentals VALUES (?,?,?,?,?,NULL)",
                     (str(uuid4()), USER, bike, route, now()))
        rental = active(conn)
    conn.execute("INSERT INTO rental_start_requests VALUES (?,?,?)", (USER, key, rental["id"]))
    return rental, created


def finish(conn, rental_id):
    required(conn.execute("SELECT 1 FROM rentals WHERE id=? AND user_id=?", (rental_id, USER)).fetchone())
    return bool(conn.execute("UPDATE rentals SET ended_at=? WHERE id=? AND ended_at IS NULL",
                             (now(), rental_id)).rowcount)
