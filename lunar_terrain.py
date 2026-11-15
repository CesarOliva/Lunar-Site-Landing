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


def _patch_paths(product: str, latitude: float, longitude: float) -> tuple[Path, Path, str]:
    center_lat = round(latitude, 2)
    center_lon = round(longitude, 2)
    key = hashlib.sha256(f"{SCHEMA_VERSION}|{product}|{center_lat:.2f}|{center_lon:.2f}".encode("ascii")).hexdigest()[:20]
    patch_path = CACHE_DIR / f"{key}.i16.gz"
    metadata_path = CACHE_DIR / f"{key}.json"
    return patch_path, metadata_path, key


def _get_patch(latitude: float, longitude: float) -> tuple[dict[str, Any], bytes, str]:
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
        patch_path, metadata_path, _ = _patch_paths(product, latitude, longitude)
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
            half_rows = half_cols = math.ceil(PROFILE_RADIUS_M * map_to_ground / metadata["map_scale_m"]) + 2
        else:
            north_pixel = MOON_RADIUS_M * math.pi / (180 * metadata["map_resolution"])
            east_pixel = north_pixel * max(0.05, math.cos(math.radians(center_lat)))
            half_rows = math.ceil(PROFILE_RADIUS_M / north_pixel) + 2
            half_cols = math.ceil(PROFILE_RADIUS_M / east_pixel) + 2
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


def evaluate_terrain(latitude: float, longitude: float, sun: dict[str, Any], earth: dict[str, Any]) -> dict[str, Any]:
    product = ("LDEM_60N_120M" if latitude >= 0 else "LDEM_60S_120M") if abs(latitude) >= 65 else "LDEM_128"
    try:
        metadata, packed, label_url = _get_patch(latitude, longitude)
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
                relative_height = value * metadata["scale_factor"] - center_height
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
        return {
            "status": status,
            "status_label": "Favorable preliminar" if status == "favorable" else "Desfavorable preliminar",
            "coverage": "available",
            "source": f"NASA LRO LOLA GDR · grilla {'polar' if polar_projection else 'global'} {metadata['map_scale_m']:g} m/píxel",
            "source_label": label_url,
            "product": product,
            "coordinate_frame": metadata["coordinate_system"],
            "resolution_m": metadata["map_scale_m"],
            "data_created": metadata["product_creation_time"],
            "max_slope_deg": round(maximum_slope, 3),
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
                "Cribado puntual y preliminar; no aplica tolerancias de un vehículo específico.",
                f"La grilla de {metadata['map_scale_m']:g} m/píxel no resuelve rocas, cráteres pequeños ni estabilidad de las patas.",
                "El DEM de LOLA se interpola entre huellas altimétricas y puede suavizar relieves locales.",
                "El perfil de horizonte cubre hasta 50 km y se muestrea cada 5° de azimut.",
                "No evalúa iluminación durante la ventana de descenso ni la duración de las operaciones.",
                "LOLA está en ME/DE421 y Horizons devuelve MEAN_ME/DE441; no se ha aplicado una transformación entre marcos.",
            ],
            "data_day": datetime.now(timezone.utc).date().isoformat(),
        }
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
