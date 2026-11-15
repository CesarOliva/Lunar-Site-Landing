"""Coarse, local lunar landing-site screening with public LOLA polar DEMs."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
import struct
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / ".cache" / "lola"
PDS_BASE = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img"
PDS_CYLINDRICAL_BASE = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img"
MOON_RADIUS_M = 1_737_400.0
PROFILE_RADIUS_M = 50_000.0
LANDING_AREA_RADIUS_M = 250.0
MAX_SLOPE_DEG = 5.0
AZIMUTH_STEP_DEG = 5.0
CHUNK_ROWS = 48
SCHEMA_VERSION = 2
PATCH_LOCK = threading.Lock()
LABEL_CACHE: dict[str, tuple[dict[str, Any], str]] = {}


class TerrainUnavailable(RuntimeError):
    pass


def _request(url: str, headers: dict[str, str] | None = None, timeout: int = 60) -> tuple[bytes, Any]:
    request_headers = {"User-Agent": "LunarSiteNavigator/0.1 (LOLA site screening)"}
    if headers:
        request_headers.update(headers)
    request = Request(url, headers=request_headers)
    with urlopen(request, timeout=timeout) as response:
        return response.read(), response.headers


def _label_value(label: str, name: str) -> str:
    match = re.search(rf"^\s*{re.escape(name)}\s*=\s*([^\r\n]+)", label, re.MULTILINE | re.IGNORECASE)
    if not match:
        raise TerrainUnavailable(f"El label LOLA no contiene {name}.")
    return match.group(1).strip().split("<", 1)[0].strip().strip("\"'")


def _metadata(product: str, base_url: str) -> tuple[dict[str, Any], str]:
    if product in LABEL_CACHE:
        return LABEL_CACHE[product]
    label_url = f"{base_url}/{product.lower()}.lbl"
    try:
        label_bytes, _ = _request(label_url, timeout=20)
    except Exception as error:
        raise TerrainUnavailable(f"No se pudo leer el label de LOLA: {error}") from error
    label = label_bytes.decode("ascii", errors="replace")
    try:
        metadata = {
            "product": product.upper(),
            "lines": int(_label_value(label, "LINES")),
            "samples": int(_label_value(label, "LINE_SAMPLES")),
            "record_bytes": int(_label_value(label, "RECORD_BYTES")),
            "map_scale_m": float(_label_value(label, "MAP_SCALE")),
            "map_resolution": float(_label_value(label, "MAP_RESOLUTION")),
            "projection": _label_value(label, "MAP_PROJECTION_TYPE").upper(),
            "sample_offset": float(_label_value(label, "SAMPLE_PROJECTION_OFFSET")),
            "line_offset": float(_label_value(label, "LINE_PROJECTION_OFFSET")),
            "center_latitude": float(_label_value(label, "CENTER_LATITUDE")),
            "center_longitude": float(_label_value(label, "CENTER_LONGITUDE")),
            "scale_factor": float(_label_value(label, "SCALING_FACTOR")),
            "offset_m": float(_label_value(label, "OFFSET")),
            "minimum_latitude": float(_label_value(label, "MINIMUM_LATITUDE")),
            "maximum_latitude": float(_label_value(label, "MAXIMUM_LATITUDE")),
            "coordinate_system": _label_value(label, "COORDINATE_SYSTEM_NAME"),
            "product_creation_time": _label_value(label, "PRODUCT_CREATION_TIME"),
        }
    except ValueError as error:
        raise TerrainUnavailable(f"No se pudo interpretar el label de LOLA: {error}") from error
    if metadata["record_bytes"] != metadata["samples"] * 2:
        raise TerrainUnavailable("El producto LOLA no tiene el formato de enteros de 16 bits esperado.")
    LABEL_CACHE[product] = metadata, label_url
    return metadata, label_url


def _pixel_center(latitude_deg: float, longitude_deg: float, metadata: dict[str, Any]) -> tuple[float, float]:
    longitude = longitude_deg % 360.0
    if "POLAR" in metadata["projection"]:
        pole = 1 if latitude_deg >= 0 else -1
        latitude = math.radians(abs(latitude_deg))
        longitude_rad = math.radians(longitude)
        radius = 2 * MOON_RADIUS_M * math.tan((math.pi / 2 - latitude) / 2)
        x = radius * math.sin(longitude_rad)
        y = -pole * radius * math.cos(longitude_rad)
        sample = metadata["sample_offset"] + x / metadata["map_scale_m"]
        line = metadata["line_offset"] - y / metadata["map_scale_m"]
        return line, sample
    resolution = metadata["map_resolution"]
    sample = metadata["sample_offset"] + (longitude - metadata["center_longitude"]) * resolution
    line = metadata["line_offset"] + (metadata["center_latitude"] - latitude_deg) * resolution
    return line, sample


def _patch_paths(product: str, latitude: float, longitude: float, coverage_radius_m: float) -> tuple[Path, Path, str]:
    center_lat = round(latitude, 2)
    center_lon = round(longitude, 2)
    radius_key = "" if coverage_radius_m == PROFILE_RADIUS_M else f"|{coverage_radius_m:g}"
    key = hashlib.sha256(f"{SCHEMA_VERSION}|{product}|{center_lat:.2f}|{center_lon:.2f}{radius_key}".encode("ascii")).hexdigest()[:20]
    patch_path = CACHE_DIR / f"{key}.i16.gz"
    metadata_path = CACHE_DIR / f"{key}.json"
    return patch_path, metadata_path, key


def _get_patch(latitude: float, longitude: float, coverage_radius_m: float = PROFILE_RADIUS_M) -> tuple[dict[str, Any], bytes, str]:
    if abs(latitude) >= 65.0:
        product = "ldem_60n_120m" if latitude >= 0 else "ldem_60s_120m"
        base_url = PDS_BASE
    else:
        product = "ldem_128"
        base_url = PDS_CYLINDRICAL_BASE
    with PATCH_LOCK:
        metadata, label_url = _metadata(product, base_url)
        if not (metadata["minimum_latitude"] <= latitude <= metadata["maximum_latitude"]):
            raise TerrainUnavailable("La posición cae fuera de la cobertura del producto LOLA.")
        patch_path, metadata_path, _ = _patch_paths(product, latitude, longitude, coverage_radius_m)
        if patch_path.exists() and metadata_path.exists():
            patch_info = json.loads(metadata_path.read_text(encoding="utf-8"))
            # Older cache records used projection metadata names for the patch
            # center, replacing the cylindrical projection's true center (180°).
            patch_info.pop("center_latitude", None)
            patch_info.pop("center_longitude", None)
            return {**metadata, **patch_info}, gzip.decompress(patch_path.read_bytes()), label_url

        center_lat = round(latitude, 2)
        center_lon = round(longitude, 2)
        center_row, center_col = _pixel_center(center_lat, center_lon, metadata)
        row_center, col_center = round(center_row), round(center_col)
        if "POLAR" in metadata["projection"]:
            map_to_ground = 2 / (1 + math.sin(math.radians(abs(center_lat))))
            half_rows = half_cols = math.ceil(coverage_radius_m * map_to_ground / metadata["map_scale_m"]) + 2
        else:
            north_pixel = MOON_RADIUS_M * math.pi / (180 * metadata["map_resolution"])
            east_pixel = north_pixel * max(0.05, math.cos(math.radians(center_lat)))
            half_rows = math.ceil(coverage_radius_m / north_pixel) + 2
            half_cols = math.ceil(coverage_radius_m / east_pixel) + 2
        row_start, row_end = row_center - half_rows, row_center + half_rows
        col_start, col_end = col_center - half_cols, col_center + half_cols
        if row_start < 0 or row_end >= metadata["lines"] or row_end < row_start:
            raise TerrainUnavailable("LOLA no cubre un radio completo de 50 km alrededor de esta posición.")
        if "POLAR" in metadata["projection"] and (col_start < 0 or col_end >= metadata["samples"]):
            raise TerrainUnavailable("LOLA no cubre un radio completo de 50 km alrededor de esta posición.")
        if col_end - col_start + 1 >= metadata["samples"]:
            raise TerrainUnavailable("La cuadrícula LOLA no cubre el radio solicitado en esta latitud.")

        rows, cols = row_end - row_start + 1, col_end - col_start + 1
        image_url = f"{base_url}/{product}.img"
        patch_data = bytearray(rows * cols * 2)
        patch_cursor = 0
        for first_row in range(row_start, row_end + 1, CHUNK_ROWS):
            last_row = min(first_row + CHUNK_ROWS - 1, row_end)
            start_byte = first_row * metadata["record_bytes"]
            end_byte = (last_row + 1) * metadata["record_bytes"] - 1
            try:
                block, headers = _request(
                    image_url,
                    {"Range": f"bytes={start_byte}-{end_byte}"},
                    timeout=90,
                )
            except Exception as error:
                raise TerrainUnavailable(f"No se pudo descargar el parche de terreno LOLA: {error}") from error
            content_range = headers.get("Content-Range", "")
            if not content_range.startswith(f"bytes {start_byte}-{end_byte}/") or len(block) != end_byte - start_byte + 1:
                raise TerrainUnavailable("El servidor LOLA no devolvió el fragmento de terreno solicitado.")
            for row in range(first_row, last_row + 1):
                row_start_byte = (row - first_row) * metadata["record_bytes"]
                raw_row = block[row_start_byte:row_start_byte + metadata["record_bytes"]]
                if "POLAR" in metadata["projection"]:
                    block_start = col_start * 2
                    sample_bytes = raw_row[block_start:block_start + cols * 2]
                else:
                    first_col = col_start % metadata["samples"]
                    first_count = min(cols, metadata["samples"] - first_col)
                    sample_bytes = raw_row[first_col * 2:(first_col + first_count) * 2]
                    if first_count < cols:
                        sample_bytes += raw_row[:(cols - first_count) * 2]
                patch_data[patch_cursor:patch_cursor + len(sample_bytes)] = sample_bytes
                patch_cursor += len(sample_bytes)

        if patch_cursor != len(patch_data):
            raise TerrainUnavailable("El parche LOLA quedó incompleto.")
        patch_info = {
            "row_start": row_start,
            "col_start": col_start,
            "rows": rows,
            "cols": cols,
            "patch_center_latitude": center_lat,
            "patch_center_longitude": center_lon,
            "coverage_radius_m": coverage_radius_m,
            "source_label": label_url,
            "source_image": image_url,
        }
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        temp_patch = patch_path.with_suffix(".tmp")
        temp_meta = metadata_path.with_suffix(".tmp")
        temp_patch.write_bytes(gzip.compress(bytes(patch_data), compresslevel=4))
        temp_meta.write_text(json.dumps(patch_info, ensure_ascii=False), encoding="utf-8")
        temp_patch.replace(patch_path)
        temp_meta.replace(metadata_path)
        return {**metadata, **patch_info}, bytes(patch_data), label_url


def evaluate_terrain(
    latitude: float,
    longitude: float,
    sun: dict[str, Any],
    earth: dict[str, Any],
    *,
    terrain_patch: tuple[dict[str, Any], bytes, str] | None = None,
    time_candidates: list[dict[str, Any]] | None = None,
    observer_height_m: float | None = None,
) -> dict[str, Any]:
    product = ("LDEM_60N_120M" if latitude >= 0 else "LDEM_60S_120M") if abs(latitude) >= 65 else "LDEM_128"
    try:
        metadata, packed, label_url = terrain_patch or _get_patch(latitude, longitude)
        rows, cols = metadata["rows"], metadata["cols"]
        data = memoryview(packed)

        def dn(row: int, col: int) -> int | None:
            if row < 0 or col < 0 or row >= rows or col >= cols:
                return None
            value = struct.unpack_from("<h", data, 2 * (row * cols + col))[0]
            return None if value == -32768 else value

        actual_lat = latitude
        actual_lon = longitude % 360.0
        site_row_pds, site_col_pds = _pixel_center(actual_lat, actual_lon, metadata)
        site_row = site_row_pds - metadata["row_start"]
        site_col = site_col_pds - metadata["col_start"]
        center_row, center_col = round(site_row), round(site_col)
        center_dn = dn(center_row, center_col)
        if center_dn is None:
            raise TerrainUnavailable("La posición no coincide con un píxel válido del DEM.")
        center_height = center_dn * metadata["scale_factor"]
        observer_height = center_height if observer_height_m is None else observer_height_m
        pole = 1 if latitude >= 0 else -1
        lon_rad = math.radians(actual_lon)
        polar_projection = "POLAR" in metadata["projection"]
        if polar_projection:
            map_to_ground = 2 / (1 + math.sin(math.radians(abs(latitude))))
            pixel_north = pixel_east = metadata["map_scale_m"] / map_to_ground
            site_x = (site_col_pds - metadata["sample_offset"]) * metadata["map_scale_m"]
            site_y = -(site_row_pds - metadata["line_offset"]) * metadata["map_scale_m"]
        else:
            pixel_north = MOON_RADIUS_M * math.pi / (180 * metadata["map_resolution"])
            pixel_east = pixel_north * max(0.05, math.cos(math.radians(latitude)))

        def local_xy(row: int, col: int) -> tuple[float, float, float]:
            row_index, col_index = row + metadata["row_start"], col + metadata["col_start"]
            if polar_projection:
                x = (col_index - metadata["sample_offset"]) * metadata["map_scale_m"]
                y = -(row_index - metadata["line_offset"]) * metadata["map_scale_m"]
                dx, dy = x - site_x, y - site_y
                east = (dx * math.cos(lon_rad) + dy * pole * math.sin(lon_rad)) / map_to_ground
                north = (-pole * dx * math.sin(lon_rad) + dy * math.cos(lon_rad)) / map_to_ground
            else:
                cell_lat = metadata["center_latitude"] - (row_index - metadata["line_offset"]) / metadata["map_resolution"]
                cell_lon = metadata["center_longitude"] + (col_index - metadata["sample_offset"]) / metadata["map_resolution"]
                delta_lon = (cell_lon - actual_lon + 180) % 360 - 180
                north = MOON_RADIUS_M * math.radians(actual_lat - cell_lat)
                east = MOON_RADIUS_M * math.cos(math.radians((actual_lat + cell_lat) / 2)) * math.radians(delta_lon)
            return east, north, math.hypot(east, north)

        # Use adjacent DEM samples within a 500 m diameter landing patch.
        maximum_slope = 0.0
        slope_samples = 0
        landing_row_cells = max(1, math.ceil(LANDING_AREA_RADIUS_M / pixel_north) + 1)
        landing_col_cells = max(1, math.ceil(LANDING_AREA_RADIUS_M / pixel_east) + 1)
        for row in range(max(0, center_row - landing_row_cells), min(rows, center_row + landing_row_cells + 1)):
            for col in range(max(0, center_col - landing_col_cells), min(cols, center_col + landing_col_cells + 1)):
                for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
                    other_row, other_col = row + dr, col + dc
                    first = dn(row, col)
                    second = dn(other_row, other_col)
                    if first is None or second is None:
                        continue
                    east1, north1, _ = local_xy(row, col)
                    east2, north2, _ = local_xy(other_row, other_col)
                    mid_east, mid_north = (east1 + east2) / 2, (north1 + north2) / 2
                    if math.hypot(mid_east, mid_north) > LANDING_AREA_RADIUS_M:
                        continue
                    distance = math.hypot(east2 - east1, north2 - north1)
                    slope = math.degrees(math.atan2(abs(second - first) * metadata["scale_factor"], distance))
                    maximum_slope = max(maximum_slope, slope)
                    slope_samples += 1
        if slope_samples == 0:
            raise TerrainUnavailable("El parche LOLA no tiene muestras suficientes para estimar la pendiente local.")

        horizon_bins = [-90.0] * int(360 / AZIMUTH_STEP_DEG)
        horizon_counts = [0] * len(horizon_bins)
        if polar_projection:
            row_radius = col_radius = math.ceil(PROFILE_RADIUS_M * map_to_ground / metadata["map_scale_m"]) + 1
        else:
            row_radius = math.ceil(PROFILE_RADIUS_M / pixel_north) + 1
            col_radius = math.ceil(PROFILE_RADIUS_M / pixel_east) + 1
        for row in range(max(0, center_row - row_radius), min(rows, center_row + row_radius + 1)):
            for col in range(max(0, center_col - col_radius), min(cols, center_col + col_radius + 1)):
                value = dn(row, col)
                if value is None:
                    continue
                east, north, distance = local_xy(row, col)
                if distance < min(pixel_north, pixel_east) * 0.5 or distance > PROFILE_RADIUS_M:
                    continue
                azimuth = math.degrees(math.atan2(east, north)) % 360.0
                bin_index = int(math.floor((azimuth + AZIMUTH_STEP_DEG / 2) / AZIMUTH_STEP_DEG)) % len(horizon_bins)
                relative_height = value * metadata["scale_factor"] - observer_height
                curvature_drop = distance * distance / (2 * MOON_RADIUS_M)
                horizon = math.degrees(math.atan2(relative_height - curvature_drop, distance))
                if horizon > horizon_bins[bin_index]:
                    horizon_bins[bin_index] = horizon
                horizon_counts[bin_index] += 1
        if any(count == 0 for count in horizon_counts):
            raise TerrainUnavailable("La cobertura del perfil de horizonte local está incompleta.")

        def horizon_for(azimuth: float) -> float:
            index = int(math.floor((azimuth % 360.0 + AZIMUTH_STEP_DEG / 2) / AZIMUTH_STEP_DEG)) % len(horizon_bins)
            return horizon_bins[index]

        sun_horizon = horizon_for(float(sun["azimuth_deg"]))
        earth_horizon = horizon_for(float(earth["azimuth_deg"]))
        sun_visible = float(sun["elevation_deg"]) > sun_horizon
        earth_visible = float(earth["elevation_deg"]) > earth_horizon
        slope_pass = maximum_slope <= MAX_SLOPE_DEG
        status = "favorable" if slope_pass and sun_visible and earth_visible else "unfavorable"
        assessment = {
            "status": status,
            "status_label": "Favorable" if status == "favorable" else "Desfavorable preliminar",
            "coverage": "available",
            "source": f"NASA LRO LOLA GDR · grilla {'polar' if polar_projection else 'global'} {metadata['map_scale_m']:g} m/píxel",
            "source_label": label_url,
            "product": product,
            "coordinate_frame": metadata["coordinate_system"],
            "resolution_m": metadata["map_scale_m"],
            "data_created": metadata["product_creation_time"],
            "max_slope_deg": round(maximum_slope, 3),
            "observer_height_m": round(observer_height, 3),
            "slope_limit_deg": MAX_SLOPE_DEG,
            "slope_samples": slope_samples,
            "landing_area_diameter_m": 2 * LANDING_AREA_RADIUS_M,
            "profile_radius_km": PROFILE_RADIUS_M / 1000,
            "azimuth_step_deg": AZIMUTH_STEP_DEG,
            "sun_horizon_deg": round(sun_horizon, 3),
            "sun_visible_over_terrain": sun_visible,
            "earth_horizon_deg": round(earth_horizon, 3),
            "earth_visible_over_terrain": earth_visible,
            "checks": {
                "slope_within_limit": slope_pass,
                "sun_visible_over_terrain": sun_visible,
                "earth_visible_over_terrain": earth_visible,
            },
            "limitations": [
                "El resultado es favorable solo si la pendiente no supera 5\u00b0 y el Sol y la Tierra quedan visibles sobre el relieve en el instante evaluado.",
                f"La evaluaci\u00f3n cubre un \u00e1rea de 500 m de di\u00e1metro; la resoluci\u00f3n LOLA es de {metadata['map_scale_m']:g} m por p\u00edxel y puede omitir rocas y cr\u00e1teres peque\u00f1os.",
                "El horizonte se calcula hasta 50 km en sectores de 5\u00b0 de azimut; relieves estrechos entre sectores pueden quedar sin detectar.",
                "El modelo interpola el relieve entre las mediciones LOLA y puede suavizar cambios topogr\u00e1ficos locales.",
                "Se eval\u00faa un \u00fanico instante; no se comprueba toda la ventana de descenso ni la duraci\u00f3n de las operaciones.",
                "LOLA usa ME/DE421 y Horizons usa MEAN_ME/DE441; los marcos no se transforman entre s\u00ed y la alineaci\u00f3n del relieve puede tener error.",
            ],
            "data_day": datetime.now(timezone.utc).date().isoformat(),
        }
        if time_candidates is not None:
            assessment["time_candidates"] = []
            assessment["time_samples"] = []
            for candidate in time_candidates:
                candidate_sun_horizon = horizon_for(float(candidate["sun"]["azimuth_deg"]))
                candidate_earth_horizon = horizon_for(float(candidate["earth"]["azimuth_deg"]))
                candidate_sun_visible = float(candidate["sun"]["elevation_deg"]) > candidate_sun_horizon
                candidate_earth_visible = float(candidate["earth"]["elevation_deg"]) > candidate_earth_horizon
                sample = {
                    "time_utc": candidate["time_utc"],
                    "sun_azimuth_deg": candidate["sun"]["azimuth_deg"],
                    "sun_elevation_deg": candidate["sun"]["elevation_deg"],
                    "earth_azimuth_deg": candidate["earth"]["azimuth_deg"],
                    "earth_elevation_deg": candidate["earth"]["elevation_deg"],
                    "sun_horizon_deg": round(candidate_sun_horizon, 3),
                    "sun_visible_over_terrain": candidate_sun_visible,
                    "earth_horizon_deg": round(candidate_earth_horizon, 3),
                    "earth_visible_over_terrain": candidate_earth_visible,
                }
                assessment["time_samples"].append(sample)
                if slope_pass and candidate_sun_visible and candidate_earth_visible:
                    assessment["time_candidates"].append(sample)
        return assessment
    except TerrainUnavailable as error:
        return {
            "status": "indeterminate",
            "status_label": "Indeterminado",
            "coverage": "unavailable",
            "source": product,
            "reason": str(error),
            "profile_radius_km": PROFILE_RADIUS_M / 1000,
        }
    except Exception as error:
        return {
            "status": "indeterminate",
            "status_label": "Indeterminado",
            "coverage": "error",
            "source": product,
            "reason": f"No se pudo procesar el DEM LOLA: {error}",
            "profile_radius_km": PROFILE_RADIUS_M / 1000,
        }


def _site_offset(latitude: float, longitude: float, distance_m: float, bearing_deg: float) -> tuple[float, float]:
    angular_distance = distance_m / MOON_RADIUS_M
    lat1, lon1, bearing = map(math.radians, (latitude, longitude, bearing_deg))
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 180) % 360 - 180


def _local_angles(direction: list[float], latitude: float, longitude: float) -> dict[str, float]:
    lat, lon = math.radians(latitude), math.radians(longitude)
    east = (-math.sin(lon), math.cos(lon), 0.0)
    north = (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat))
    up = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    east_dot = sum(direction[index] * east[index] for index in range(3))
    north_dot = sum(direction[index] * north[index] for index in range(3))
    up_dot = sum(direction[index] * up[index] for index in range(3))
    return {
        "azimuth_deg": math.degrees(math.atan2(east_dot, north_dot)) % 360,
        "elevation_deg": math.degrees(math.asin(max(-1.0, min(1.0, up_dot)))),
    }


def search_nearby_sites(
    latitude: float,
    longitude: float,
    sun: dict[str, Any],
    earth: dict[str, Any],
) -> list[dict[str, Any]]:
    search_radius_m = 5_000.0
    step_m = 1_000.0
    bearings = range(0, 360, 45)
    terrain_patch = _get_patch(latitude, longitude, PROFILE_RADIUS_M + search_radius_m + 250)
    for distance_m in range(int(step_m), int(search_radius_m + step_m), int(step_m)):
        viable = []
        for bearing in bearings:
            candidate_lat, candidate_lon = _site_offset(latitude, longitude, distance_m, bearing)
            candidate_sun = _local_angles(sun["direction_me"], candidate_lat, candidate_lon)
            candidate_earth = _local_angles(earth["direction_me"], candidate_lat, candidate_lon)
            result = evaluate_terrain(
                candidate_lat,
                candidate_lon,
                candidate_sun,
                candidate_earth,
                terrain_patch=terrain_patch,
            )
            if result.get("status") == "favorable":
                viable.append({
                    "latitude_deg": round(candidate_lat, 6),
                    "longitude_deg": round(candidate_lon, 6),
                    "distance_m": round(distance_m),
                    "bearing_deg": bearing,
                    "max_slope_deg": result["max_slope_deg"],
                    "sun_clearance_deg": round(candidate_sun["elevation_deg"] - result["sun_horizon_deg"], 3),
                    "earth_clearance_deg": round(candidate_earth["elevation_deg"] - result["earth_horizon_deg"], 3),
                })
        if viable:
            return sorted(viable, key=lambda item: (-min(item["sun_clearance_deg"], item["earth_clearance_deg"]), item["max_slope_deg"]))[:3]
    return []
