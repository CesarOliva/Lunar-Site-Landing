#!/usr/bin/env python3
"""Fetch and preserve JPL Horizons Apollo landing scenes for the web globe."""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lunar_terrain import evaluate_terrain


CATALOG = ROOT / "data" / "apollo_sites.json"
SCENES = ROOT / "data" / "apollo_scenes.json"
RAW_DIR = ROOT / "data" / "horizons" / "raw"
ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api"
TARGETS = {"sun": "10", "earth": "399"}


def unit_spherical_direction(latitude_deg: float, longitude_deg: float, azimuth_deg: float, elevation_deg: float) -> list[float]:
    lat, lon, az, el = map(math.radians, (latitude_deg, longitude_deg, azimuth_deg, elevation_deg))
    east = (-math.sin(lon), math.cos(lon), 0.0)
    north = (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat))
    up = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    horizontal_north = math.cos(el) * math.cos(az)
    horizontal_east = math.cos(el) * math.sin(az)
    vertical = math.sin(el)
    vector = [
        horizontal_north * north[i] + horizontal_east * east[i] + vertical * up[i]
        for i in range(3)
    ]
    magnitude = math.sqrt(sum(component * component for component in vector))
    return [round(component / magnitude, 9) for component in vector]


def parse_horizons(raw: bytes, mission_id: str, target: str) -> dict:
    payload = json.loads(raw)
    if payload.get("error"):
        raise ValueError(f"Horizons error for {mission_id}/{target}: {payload['error']}")
    text = payload.get("result", "")
    block = text.split("$$SOE", 1)[-1].split("$$EOE", 1)[0].strip()
    line = next((item for item in block.splitlines() if item.strip()), "")
    angles = re.search(r"([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*$", line)
    if not angles:
        raise ValueError(f"No azimuth/elevation row for {mission_id}/{target}")
    source = re.search(r"Target body name:.*?\{source:\s*([^}]+)\}", text)
    frame = re.search(r"Center pole/equ:\s*(.*?)\s*\{", text)
    return {
        "azimuth_deg": float(angles.group(1)),
        "elevation_deg": float(angles.group(2)),
        "ephemeris_source": source.group(1).strip() if source else "not reported",
        "center_frame": frame.group(1).strip() if frame else "not reported",
        "response": payload,
    }


def query_horizons(mission_id: str, target: str, site: dict, landing_time: str) -> tuple[bytes, dict]:
    site_coord = f"{site['longitude_deg']},{site['latitude_deg']},0"
    query = {
        "format": "json",
        "COMMAND": f"'{TARGETS[target]}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{site_coord}'",
        "TLIST": f"'{landing_time[:10]} {landing_time[11:19]}'",
        "TLIST_TYPE": "'CAL'",
        "TIME_TYPE": "'UT'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",
    }
    request = Request(f"{ENDPOINT}?{urlencode(query)}", headers={"User-Agent": "LunarSiteNavigator/0.1"})
    with urlopen(request, timeout=45) as response:
        raw = response.read()
    return raw, parse_horizons(raw, mission_id, target)


def build_scene(mission: dict, records: dict[str, dict], raw_paths: dict[str, str]) -> dict:
    site = mission["latitude_deg"], mission["longitude_deg"]
    result = {"site": {"latitude_deg": site[0], "longitude_deg": site[1], "altitude_km": 0}, "time_utc": mission["landing_time_utc"]}
    result["query"] = {
        "COMMAND": {"sun": "10", "earth": "399"},
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"{site[1]},{site[0]},0",
        "TLIST": mission["landing_time_utc"][:10] + " " + mission["landing_time_utc"][11:19] + " UT",
        "TIME_TYPE": "UT",
        "QUANTITIES": "4",
        "ANG_FORMAT": "DEG",
        "APPARENT": "AIRLESS",
    }
    for body in ("sun", "earth"):
        record = records[body]
        elevation = record["elevation_deg"]
        result[body] = {
            "azimuth_deg": record["azimuth_deg"],
            "elevation_deg": elevation,
            "direction_me": unit_spherical_direction(*site, record["azimuth_deg"], elevation),
            "above_geometric_horizon": elevation > 0,
            "terrain_visibility": "indeterminate",
            "source": record["ephemeris_source"],
            "source_file": raw_paths[body],
        }
    result["landing_assessment"] = evaluate_terrain(site[0], site[1], result["sun"], result["earth"])
    assessment = result["landing_assessment"]
    if assessment.get("coverage") == "available":
        result["sun"]["terrain_visibility"] = "visible" if assessment["sun_visible_over_terrain"] else "blocked"
        result["earth"]["terrain_visibility"] = "visible" if assessment["earth_visible_over_terrain"] else "blocked"
    result["response_frame"] = records["sun"]["center_frame"]
    return result


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pending: dict[str, tuple[bytes, dict]] = {}
    for mission in catalog["missions"]:
        mission_id = mission["id"]
        for target in TARGETS:
            key = f"{mission_id}-{target}"
            raw_path = RAW_DIR / f"{key}.json"
            if raw_path.exists():
                raw = raw_path.read_bytes()
                pending[key] = raw, parse_horizons(raw, mission_id, target)
            else:
                pending[key] = query_horizons(mission_id, target, mission, mission["landing_time_utc"])

    scenes = {}
    shared_sources: set[str] = set()
    for mission in catalog["missions"]:
        mission_id = mission["id"]
        print(f"Evaluando terreno: {mission['mission']}...", flush=True)
        records, raw_paths = {}, {}
        for target in TARGETS:
            key = f"{mission_id}-{target}"
            raw, parsed = pending[key]
            path = RAW_DIR / f"{key}.json"
            path.write_bytes(raw)
            relative = path.relative_to(ROOT).as_posix()
            raw_paths[target] = relative
            records[target] = parsed
            shared_sources.add(parsed["ephemeris_source"])
        scenes[mission_id] = build_scene(mission, records, raw_paths)

    document = {
        "schema_version": 2,
        "generated_utc": datetime.now(timezone.utc).date().isoformat(),
        "ephemeris": {
            "provider": "NASA/JPL Horizons API",
            "endpoint": ENDPOINT,
            "api_version": "1.2",
            "ephemeris_source": ", ".join(sorted(shared_sources)),
            "time_type": "UT",
            "time_note": "Se consultan las horas UT originales de NSSDCA. Horizons informa las fechas posteriores a 1962 en UTC, escala civil mantenida dentro de 0.9 s de UT1.",
            "center_frame": "MEAN_ME (high precision), según las respuestas de Horizons",
            "site_coordinates": "SITE_COORD = longitud este, latitud planetocéntrica, altitud km; coordenadas ME del catálogo",
            "apparent_place": "Airless azimuth/elevation; quantity 4; light-time, deflexión gravitacional, aberración estelar, precesión y nutación según Horizons",
            "horizon_model": "NASA LRO LOLA local horizons (50 km radius, 5 degree azimuth bins) and preliminary slope screen at each landing instant.",
            "sun_vector_method": "Se reconstruye la dirección fija a la Luna a partir del azimut y elevación locales, y de las bases este, norte y cenit del sitio en coordenadas ME.",
            "render_axis_mapping": "Three.js Y-up: (x_ME, y_ME, z_ME) -> (x, z, -y). La textura global de NASA está centrada en longitud 0° y orientada norte arriba.",
        },
        "missions": scenes,
    }
    SCENES.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(scenes)} Apollo scenes and {len(pending)} raw Horizons responses.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(2)
