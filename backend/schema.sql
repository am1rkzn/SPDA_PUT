CREATE TABLE users(id TEXT PRIMARY KEY, display_name TEXT NOT NULL);
CREATE TABLE routes(
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
    categories_json TEXT NOT NULL, duration_min INTEGER NOT NULL CHECK(duration_min > 0),
    tags_json TEXT NOT NULL, start_lon REAL NOT NULL, start_lat REAL NOT NULL,
    geometry_json TEXT NOT NULL, source TEXT NOT NULL, verified INTEGER NOT NULL CHECK(verified IN (0,1))
);
CREATE TABLE bikes(id TEXT PRIMARY KEY, label TEXT NOT NULL, lon REAL NOT NULL, lat REAL NOT NULL);
CREATE TABLE rentals(
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users,
    bike_id TEXT NOT NULL REFERENCES bikes, route_id TEXT NOT NULL REFERENCES routes,
    started_at TEXT NOT NULL, ended_at TEXT
);
CREATE UNIQUE INDEX active_user ON rentals(user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX active_bike ON rentals(bike_id) WHERE ended_at IS NULL;
CREATE TABLE rental_start_requests(
    user_id TEXT NOT NULL REFERENCES users, request_key TEXT NOT NULL,
    rental_id TEXT NOT NULL REFERENCES rentals, PRIMARY KEY(user_id,request_key)
);
