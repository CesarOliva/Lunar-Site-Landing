#!/usr/bin/env python3
"""Small local JSON API for custom lunar observer scenes."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from scripts.precompute_apollo_scenes import query_horizons, unit_spherical_direction
from lunar_terrain import evaluate_terrain


ROOT = Path(__file__).resolve().parent
CACHE_PATH = ROOT / ".cache" / "horizons.sqlite3"
CACHE_VERSION = 3
MIN_TIME = datetime(1962, 1, 20, tzinfo=timezone.utc)
CACHE_LOCK = threading.Lock()


class RequestError(ValueError):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.status = status


def parse_request(payload: Any) -> tuple[float, float, datetime]:
    if not isinstance(payload, dict):
        raise RequestError("El cuerpo debe ser un objeto JSON.")

    raw_latitude, raw_longitude = payload.get("latitude_deg"), payload.get("longitude_deg")
    if isinstance(raw_latitude, bool) or isinstance(raw_longitude, bool):
        raise RequestError("Ingresa latitud y longitud numéricas.")
    try:
        latitude = float(raw_latitude)
        longitude = float(raw_longitude)
    except (KeyError, TypeError, ValueError):
        raise RequestError("Ingresa latitud y longitud numéricas.") from None
    if not (-90 <= latitude <= 90):
        raise RequestError("La latitud debe estar entre −90° y 90°.")
    if not (-180 <= longitude <= 180):
        raise RequestError("La longitud debe estar entre −180° y 180°.")

    raw_time = payload.get("time_utc")
    if not isinstance(raw_time, str) or not raw_time.endswith("Z"):
        raise RequestError("La fecha debe incluir hora UTC y terminar en Z.")
    try:
        instant = datetime.fromisoformat(raw_time[:-1] + "+00:00")
    except ValueError:
        raise RequestError("La fecha y hora no tienen un formato ISO válido.") from None
    if instant < MIN_TIME:
        raise RequestError("Horizons admite esta consulta con escala UTC/UT desde 1962-01-20.")
    if instant > datetime.now(timezone.utc) + timedelta(days=75):
        raise RequestError("La fecha supera el horizonte de predicción EOP de Horizons (75 días).")

    return latitude, longitude, instant.replace(microsecond=0)


def cache_key(latitude: float, longitude: float, instant: datetime) -> str:
    identity = json.dumps(
        [CACHE_VERSION, datetime.now(timezone.utc).date().isoformat(), latitude, longitude, instant.isoformat()],
        separators=(",", ":"),
    )
    return hashlib.sha256(identity.encode("ascii")).hexdigest()


def cached_scene(key: str) -> dict[str, Any] | None:
    if not CACHE_PATH.exists():
        return None
    with CACHE_LOCK, sqlite3.connect(CACHE_PATH, timeout=10) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS scenes (cache_key TEXT PRIMARY KEY, scene_json TEXT NOT NULL, created_utc TEXT NOT NULL)"
        )
        row = connection.execute("SELECT scene_json FROM scenes WHERE cache_key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def store_scene(key: str, scene: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CACHE_LOCK, sqlite3.connect(CACHE_PATH, timeout=10) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS scenes (cache_key TEXT PRIMARY KEY, scene_json TEXT NOT NULL, created_utc TEXT NOT NULL)"
        )
        connection.execute(
            "INSERT OR REPLACE INTO scenes(cache_key, scene_json, created_utc) VALUES (?, ?, ?)",
            (key, json.dumps(scene, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
        )
        connection.execute(
            "DELETE FROM scenes WHERE created_utc < ?",
            ((datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),),
        )


def make_scene(latitude: float, longitude: float, instant: datetime, records: dict[str, dict[str, Any]]) -> dict[str, Any]:
    site = {"latitude_deg": latitude, "longitude_deg": longitude}
    scene: dict[str, Any] = {
        "site": {"latitude_deg": latitude, "longitude_deg": longitude, "altitude_km": 0},
        "time_utc": instant.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "ephemeris_source": records["sun"]["ephemeris_source"],
        "horizons_data_day": datetime.now(timezone.utc).date().isoformat(),
        "response_frame": records["sun"]["center_frame"],
        "coordinate_frame": "ME; east longitude positive",
        "query": {
            "CENTER": "coord@301",
            "COORD_TYPE": "GEODETIC",
            "SITE_COORD": f"{longitude},{latitude},0",
            "TLIST": instant.strftime("%Y-%m-%d %H:%M:%S UT"),
            "TIME_TYPE": "UT",
            "QUANTITIES": "4",
            "ANG_FORMAT": "DEG",
            "APPARENT": "AIRLESS",
        },
        "horizon": {"elevation_deg": None, "terrain_visibility": "indeterminate", "source": None},
    }
    for body, record in records.items():
        elevation = record["elevation_deg"]
        scene[body] = {
            "azimuth_deg": record["azimuth_deg"],
            "elevation_deg": elevation,
            "direction_me": unit_spherical_direction(
                latitude, longitude, record["azimuth_deg"], elevation
            ),
            "above_geometric_horizon": elevation > 0,
            "terrain_visibility": "indeterminate",
            "source": record["ephemeris_source"],
        }
    return scene


def query_scene(latitude: float, longitude: float, instant: datetime) -> dict[str, Any]:
    key = cache_key(latitude, longitude, instant)
    scene = cached_scene(key)
    if scene is not None:
        scene["cached"] = True
        return scene

    site = {"latitude_deg": latitude, "longitude_deg": longitude}
    time_value = instant.isoformat(timespec="seconds").replace("+00:00", "Z")
    records: dict[str, dict[str, Any]] = {}
    # The two apparent place queries are independent and can be fetched in
    # parallel, while the HTTP server continues to handle other requests.
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            body: pool.submit(query_horizons, "custom", body, site, time_value)
            for body in ("sun", "earth")
        }
        for body, future in futures.items():
            _raw, parsed = future.result()
            records[body] = parsed

    scene = make_scene(latitude, longitude, instant, records)
    scene["landing_assessment"] = evaluate_terrain(latitude, longitude, scene["sun"], scene["earth"])
    assessment = scene["landing_assessment"]
    if assessment.get("coverage") == "available":
        scene["sun"]["terrain_visibility"] = "visible" if assessment["sun_visible_over_terrain"] else "blocked"
        scene["earth"]["terrain_visibility"] = "visible" if assessment["earth_visible_over_terrain"] else "blocked"
    store_scene(key, scene)
    scene["cached"] = False
    return scene


class NavigatorHandler(BaseHTTPRequestHandler):
    server_version = "LunarNavigator/0.1"

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")

    def send_json(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:
        if self.path != "/api/scene":
            self.send_json(404, {"error": "Ruta no encontrada."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 8192:
                raise RequestError("El cuerpo de la consulta es demasiado grande.", 413)
            payload = json.loads(self.rfile.read(length))
            latitude, longitude, instant = parse_request(payload)
            self.send_json(200, query_scene(latitude, longitude, instant))
        except RequestError as error:
            self.send_json(error.status, {"error": str(error)})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "El cuerpo debe ser JSON válido."})
        except Exception as error:
            self.send_json(502, {"error": f"No se pudo completar la consulta a Horizons: {error}"})


def main() -> None:
    host, port = "127.0.0.1", 8000
    server = ThreadingHTTPServer((host, port), NavigatorHandler)
    print(f"Lunar Navigator API: http://{host}:{port}")
    print("Interrumpe con Ctrl+C para detener el servicio.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServicio detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
