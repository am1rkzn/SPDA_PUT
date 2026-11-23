import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from backend import db
from backend.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        temp = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.dict(os.environ, PUT_DB_PATH=str(Path(temp) / "test.sqlite"),
                                    PUT_OTEL_ENABLED="false"))
        self.client = self.enterContext(TestClient(app))

    def start(self, key, bike="b1", route="r1"):
        return self.client.post("/api/rental", json={"bike_id": bike, "route_id": route},
                                headers={"Idempotency-Key": str(key)})

    def finish(self, rid):
        return self.client.post("/api/rental/finish", json={"rental_id": rid})

    def test_catalog(self):
        self.assertEqual(self.client.get("/readyz").status_code, 200)
        with db.connection(write=True) as conn:
            conn.execute("""INSERT INTO routes SELECT 'a',title,description,categories_json,
                duration_min,'["центр"]',start_lon,start_lat,geometry_json,source,verified FROM routes""")
        longest = max(c["durationMin"] for c in self.client.get("/api/routes").json())
        cards = self.client.get("/api/routes", params={"tags": " центр ,ЦЕНТР,набережная",
                                                       "max_duration": longest, "trip_type": "любой"}).json()
        # При равном числе совпавших тегов порядок задаёт ORDER BY id.
        self.assertEqual(sorted(c["id"] for c in cards), ["a", "r1"])
        self.assertNotIn("geometry", cards[0])
        self.assertEqual(self.client.get("/api/routes/r1").json()["geometry"]["type"], "LineString")
        self.assertEqual(self.client.get(f"/api/routes?max_duration={longest - 1}").json(), [])
        for value in ["0", "-1", "30.5", "abc"]:
            self.assertEqual(self.client.get("/api/routes?max_duration="+value).status_code, 422)
        self.assertEqual(self.client.get("/api/routes?trip_type=other").status_code, 422)
        self.assertEqual(self.client.get("/api/routes/unknown").status_code, 404)
        self.assertIsNone(self.client.get("/api/rental").json())

    def test_concurrent_and_late_replays(self):
        key, alias = uuid4(), uuid4()
        with ThreadPoolExecutor(4) as pool:
            responses = list(pool.map(self.start, [key, key, alias, alias]))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 200, 200, 201])
        rid = responses[0].json()["id"]
        self.assertEqual({r.json()["id"] for r in responses}, {rid})
        self.assertEqual(self.start(key, bike="other").json()["error"]["code"], "IDEMPOTENCY_CONFLICT")
        self.assertEqual(self.client.get("/api/bikes").json()[0]["status"], "busy")
        db.initialize()
        self.assertEqual(self.client.get("/api/rental").json()["id"], rid)
        self.assertEqual(self.finish(rid).status_code, 204)
        next_id = self.start(uuid4()).json()["id"]
        self.assertNotEqual(next_id, rid)
        self.assertEqual(self.start(alias).json()["id"], rid)
        self.assertEqual(self.finish(rid).content, b"")
        self.assertEqual(self.client.get("/api/rental").json()["id"], next_id)
        self.finish(next_id)
        self.assertEqual(self.client.get("/api/bikes").json()[0]["status"], "available")
        with db.connection() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM rentals WHERE user_id=?",
                                          (db.USER,)).fetchone()[0], 2)

    def test_errors(self):
        self.assertEqual(self.start("bad").status_code, 422)
        self.assertEqual(self.finish("bad").status_code, 422)
        self.assertEqual(self.finish(str(uuid4())).status_code, 404)
        self.assertEqual(self.start(uuid4(), bike="unknown").status_code, 404)
        self.start(uuid4())
        with db.connection(write=True) as conn:
            conn.execute("INSERT INTO bikes VALUES ('b99','B',49,55)")
        self.assertEqual(self.start(uuid4(), bike="b99").json()["error"]["code"], "RENTAL_ACTIVE")
        with db.connection(write=True) as conn:
            conn.execute("INSERT INTO users VALUES ('other','Other')")
            conn.execute("UPDATE rentals SET user_id='other' WHERE user_id=?", (db.USER,))
        self.assertEqual(self.start(uuid4()).json()["error"]["code"], "BIKE_BUSY")
        with db.connection(write=True):
            self.assertEqual(self.start(uuid4()).status_code, 503)
        with patch.dict(os.environ, PUT_DB_PATH=str(Path(os.environ["PUT_DB_PATH"]).with_suffix(".missing"))):
            self.assertEqual(self.client.get("/api/rental").status_code, 503)
            self.assertEqual(self.client.get("/readyz").status_code, 503)
            self.assertEqual(self.client.get("/healthz").status_code, 200)
