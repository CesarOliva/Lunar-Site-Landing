#!/usr/bin/env python3
"""Small local JSON API for custom lunar observer scenes."""

from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from scripts.precompute_apollo_scenes import ENDPOINT, TARGETS, query_horizons, unit_spherical_direction
from lunar_terrain import evaluate_terrain, search_nearby_sites


ROOT = Path(__file__).resolve().parent
CACHE_PATH = ROOT / ".cache" / "horizons.sqlite3"
CACHE_VERSION = 3
MIN_TIME = datetime(1962, 1, 20, tzinfo=timezone.utc)
CACHE_LOCK = threading.Lock()
SEARCH_WINDOW = timedelta(days=7)


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


def query_horizons_range(target: str, site: dict[str, float], start: datetime, end: datetime) -> dict[str, dict[str, float]]:
    query = {
        "format": "json",
        "COMMAND": f"'{TARGETS[target]}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{site['longitude_deg']},{site['latitude_deg']},{site.get('altitude_km', 0)}'",
        "START_TIME": f"'{start:%Y-%m-%d %H:%M:%S}'",
        "STOP_TIME": f"'{end:%Y-%m-%d %H:%M:%S}'",
        "STEP_SIZE": "'1 h'",
        "TIME_TYPE": "'UT'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",
    }
    request = Request(f"{ENDPOINT}?{urlencode(query)}", headers={"User-Agent": "LunarSiteNavigator/0.1"})
    with urlopen(request, timeout=90) as response:
        payload = json.loads(response.read())
    if payload.get("error"):
        raise ValueError(f"Horizons: {payload['error']}")
    text = payload.get("result", "")
    block = text.split("$$SOE", 1)[-1].split("$$EOE", 1)[0]
    output = {}
    for line in block.splitlines():
        timestamp = re.match(r"\s*(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)", line)
        angles = re.search(r"([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*$", line)
        if not timestamp or not angles:
            continue
        year, month, day, clock = re.match(
            r"(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d+)", timestamp.group(1)
        ).groups()
        month_number = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}[month]
        instant = datetime.strptime(f"{year}-{month_number:02}-{day} {clock}", "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=timezone.utc)
        key = instant.isoformat(timespec="seconds").replace("+00:00", "Z")
        output[key] = {"azimuth_deg": float(angles.group(1)), "elevation_deg": float(angles.group(2))}
    if not output:
        raise ValueError("Horizons no devolvió posiciones horarias en el intervalo solicitado.")
    return output


def query_visibility_day(latitude: float, longitude: float, instant: datetime, altitude_m: float = 0) -> dict[str, Any]:
    day_start = instant.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(hours=23)
    if day_end > datetime.now(timezone.utc) + timedelta(days=75):
        raise RequestError("El final del dÃ­a supera el horizonte de predicciÃ³n de Horizons (75 dÃ­as).")

    cache_identity = json.dumps([
        CACHE_VERSION,
        "visibility-day",
        datetime.now(timezone.utc).date().isoformat(),
        latitude,
        longitude,
        altitude_m,
        day_start.isoformat(),
    ], separators=(",", ":"))
    key = hashlib.sha256(cache_identity.encode("ascii")).hexdigest()
    cached = cached_scene(key)
    if cached is not None:
        cached["cached"] = True
        return cached

    site = {"latitude_deg": latitude, "longitude_deg": longitude, "altitude_km": altitude_m / 1000}
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            body: pool.submit(query_horizons_range, body, site, day_start, day_end)
            for body in ("sun", "earth")
        }
        positions = {body: future.result() for body, future in futures.items()}

    times = sorted(positions["sun"].keys() & positions["earth"].keys())
    if not times:
        raise ValueError("Horizons no devolviÃ³ posiciones simultÃ¡neas del Sol y la Tierra para este dÃ­a.")
    candidates = [
        {"time_utc": time, "sun": positions["sun"][time], "earth": positions["earth"][time]}
        for time in times
    ]
    assessment = evaluate_terrain(
        latitude,
        longitude,
        candidates[0]["sun"],
        candidates[0]["earth"],
        time_candidates=candidates,
        observer_height_m=altitude_m,
    )
    terrain_available = assessment.get("coverage") == "available"
    terrain_samples = {sample["time_utc"]: sample for sample in assessment.get("time_samples", [])}
    samples = []
    for candidate in candidates:
        terrain_sample = terrain_samples.get(candidate["time_utc"], {})
        sample = {"time_utc": candidate["time_utc"]}
        for body in ("sun", "earth"):
            position = candidate[body]
            horizon_key = f"{body}_horizon_deg"
            visible_key = f"{body}_visible_over_terrain"
            terrain_horizon = terrain_sample.get(horizon_key) if terrain_available else None
            terrain_visible = terrain_sample.get(visible_key) if terrain_available else None
            elevation = float(position["elevation_deg"])
            sample[body] = {
                "azimuth_deg": float(position["azimuth_deg"]),
                "elevation_deg": elevation,
                "terrain_horizon_deg": terrain_horizon,
                "margin_deg": round(elevation - terrain_horizon, 3) if terrain_horizon is not None else round(elevation, 3),
                "state": ("visible" if terrain_visible else "hidden") if terrain_visible is not None else ("visible" if elevation > 0 else "hidden"),
                "terrain_visibility": ("visible" if terrain_visible else "blocked") if terrain_visible is not None else "indeterminate",
                "above_geometric_horizon": elevation > 0,
            }
        samples.append(sample)

    result = {
        "site": {"latitude_deg": latitude, "longitude_deg": longitude, "altitude_m": altitude_m},
        "date_utc": day_start.date().isoformat(),
        "sample_step_hours": 1,
        "horizon_basis": "terrain" if terrain_available else "geometric",
        "terrain": {
            "coverage": assessment.get("coverage", "unavailable"),
            "source": assessment.get("source"),
            "resolution_m": assessment.get("resolution_m"),
            "profile_radius_km": assessment.get("profile_radius_km"),
            "reason": assessment.get("reason"),
            "limitations": assessment.get("limitations", []),
        },
        "samples": samples,
        "cached": False,
    }
    store_scene(key, result)
    return result


def find_alternative_dates(latitude: float, longitude: float, instant: datetime, scene: dict[str, Any]) -> dict[str, Any]:
    assessment = scene.get("landing_assessment", {})
    if assessment.get("coverage") != "available":
        return {"mode": "date", "candidates": [], "reason": assessment.get("reason", "Hace falta un perfil LOLA válido.")}
    if not assessment.get("checks", {}).get("slope_within_limit"):
        return {"mode": "date", "candidates": [], "reason": "La pendiente de este sitio supera el límite y cambiar la fecha no la modifica."}

    now = datetime.now(timezone.utc)
    start = max(instant.replace(minute=0, second=0) - SEARCH_WINDOW, MIN_TIME)
    end = min(instant.replace(minute=0, second=0) + SEARCH_WINDOW, now + timedelta(days=75))
    if start >= end:
        return {"mode": "date", "candidates": [], "reason": "No hay intervalo de búsqueda disponible para esta fecha."}
    site = {"latitude_deg": latitude, "longitude_deg": longitude}
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {body: pool.submit(query_horizons_range, body, site, start, end) for body in ("sun", "earth")}
        positions = {body: future.result() for body, future in futures.items()}
    candidates = [
        {"time_utc": time, "sun": positions["sun"][time], "earth": positions["earth"][time]}
        for time in positions["sun"].keys() & positions["earth"].keys()
    ]
    assessment = evaluate_terrain(
        latitude,
        longitude,
        scene["sun"],
        scene["earth"],
        time_candidates=candidates,
    )
    ranked = sorted(
        assessment.get("time_candidates", []),
        key=lambda candidate: abs((datetime.fromisoformat(candidate["time_utc"].replace("Z", "+00:00")) - instant).total_seconds()),
    )
    return {
        "mode": "date",
        "step_hours": 1,
        "window_days": SEARCH_WINDOW.days,
        "candidates": [
            {
                **candidate,
                "delta_hours": round((datetime.fromisoformat(candidate["time_utc"].replace("Z", "+00:00")) - instant).total_seconds() / 3600, 1),
            }
            for candidate in ranked[:3]
        ],
        "reason": None if ranked else "No se encontró una hora favorable en el intervalo de siete días alrededor de la fecha, muestreado cada hora.",
    }


def find_alternative_locations(latitude: float, longitude: float, scene: dict[str, Any]) -> dict[str, Any]:
    assessment = scene.get("landing_assessment", {})
    if assessment.get("coverage") != "available":
        return {"mode": "location", "candidates": [], "reason": assessment.get("reason", "Hace falta un perfil LOLA válido.")}
    try:
        candidates = search_nearby_sites(latitude, longitude, scene["sun"], scene["earth"])
    except Exception as error:
        return {"mode": "location", "candidates": [], "reason": f"No se pudo cargar el perfil LOLA ampliado: {error}"}
    return {
        "mode": "location",
        "radius_km": 5,
        "step_km": 1,
        "candidates": candidates,
        "reason": None if candidates else "No se encontraron puntos favorables dentro de 5 km en esta búsqueda de ocho rumbos por kilómetro.",
    }


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
        if self.path not in ("/api/scene", "/api/alternatives", "/api/visibility-day"):
            self.send_json(404, {"error": "Ruta no encontrada."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 8192:
                raise RequestError("El cuerpo de la consulta es demasiado grande.", 413)
            payload = json.loads(self.rfile.read(length))
            latitude, longitude, instant = parse_request(payload)
            if self.path == "/api/scene":
                self.send_json(200, query_scene(latitude, longitude, instant))
                return
            if self.path == "/api/visibility-day":
                raw_altitude = payload.get("altitude_m", 0)
                if isinstance(raw_altitude, bool):
                    raise RequestError("La elevaciÃ³n debe ser un nÃºmero en metros.")
                try:
                    altitude_m = float(raw_altitude)
                except (TypeError, ValueError):
                    raise RequestError("La elevaciÃ³n debe ser un nÃºmero en metros.") from None
                if not math.isfinite(altitude_m) or not -10000 <= altitude_m <= 20000:
                    raise RequestError("La elevaciÃ³n debe estar entre âˆ’10.000 y 20.000 m sobre el radio lunar medio.")
                self.send_json(200, query_visibility_day(latitude, longitude, instant, altitude_m))
                return
            mode = payload.get("mode")
            if mode not in ("location", "date"):
                raise RequestError("El tipo de búsqueda debe ser location o date.")
            scene = query_scene(latitude, longitude, instant)
            if mode == "location":
                result = find_alternative_locations(latitude, longitude, scene)
            else:
                result = find_alternative_dates(latitude, longitude, instant, scene)
            self.send_json(200, result)
        except RequestError as error:
            self.send_json(error.status, {"error": str(error)})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "El cuerpo debe ser JSON válido."})
        except Exception as error:
            self.send_json(502, {"error": f"No se pudo completar la evaluación: {error}"})


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
