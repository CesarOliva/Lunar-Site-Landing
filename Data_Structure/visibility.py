"""Calcula visibilidad geométrica desde un punto lunar con LOLA y JPL Horizons."""

import argparse
import csv
import json
import math
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE_FILE = ROOT / "data" / "visibility-site.json"
OUTPUT = ROOT / "data" / "visibility"
HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
TARGETS = {"sun": "10", "earth": "399"}


def read_site():
    with SITE_FILE.open(encoding="utf-8") as file:
        return json.load(file)


def api_request(target, site, dem_altitude_m, start, stop, step, label):
    params = {
        "format": "json", "COMMAND": target, "OBJ_DATA": "NO", "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER", "CENTER": "coord@301", "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"{site['longitude_east_deg']},{site['latitude_deg']},{dem_altitude_m / 1000:.9f}",
        "START_TIME": start, "STOP_TIME": stop, "STEP_SIZE": step,
        "TIME_TYPE": "UT", "TIME_DIGITS": "SECONDS", "QUANTITIES": "4",
        "APPARENT": "AIRLESS", "CSV_FORMAT": "YES", "ANG_FORMAT": "DEG",
    }
    url = HORIZONS_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "LunarLandingSiteNavigator/0.1"})

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Horizons no respondió correctamente para {target} ({label}): {error}") from error

    if "error" in payload:
        raise RuntimeError(f"Horizons rechazó la consulta de {target}: {payload['error']}")

    result = payload.get("result", "")

    if not re.search(r"Center pole/equ\s*:\s*MEAN_ME\b", result):
        raise RuntimeError("Horizons no reportó el marco lunar Mean Earth esperado.")

    if not re.search(r"Center radii\s*:\s*1737\.4,\s*1737\.4,\s*1737\.4", result):
        raise RuntimeError("El radio de referencia de Horizons no coincide con el radio lunar del DEM.")

    center = re.search(r"Center geodetic\s*:\s*([-+\d.]+),\s*([-+\d.]+),\s*([-+\d.]+)", result)
    if not center:
        raise RuntimeError("Horizons no devolvió las coordenadas geodéticas del observador.")

    lon, lat, altitude_km = map(float, center.groups())
    if (abs(lon - site["longitude_east_deg"]) > 1e-5 or
            abs(lat - site["latitude_deg"]) > 1e-5 or
            abs(altitude_km * 1000 - dem_altitude_m) > 0.01):
        raise RuntimeError("Horizons cambió las coordenadas o altura del observador configuradas.")

    raw_dir = OUTPUT / "horizons"
    raw_dir.mkdir(parents=True, exist_ok=True)
    (raw_dir / f"{label}-{target}.json").write_text(
        json.dumps({"request_parameters": params, "response": payload}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    try:
        table = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    except IndexError as error:
        raise RuntimeError(f"Respuesta sin tabla de efemérides para {target} ({label}).") from error
    rows = {}

    for fields in csv.reader(table.splitlines()):
        fields = [value.strip() for value in fields]

        if len(fields) < 3 or not fields[0] or fields[0].startswith("*"):
            continue

        try:
            time = datetime.strptime(fields[0], "%Y-%b-%d %H:%M:%S")
            azimuth, elevation = float(fields[-3]), float(fields[-2])
        except (ValueError, IndexError):
            continue

        rows[time] = (azimuth, elevation)

    if not rows:
        raise RuntimeError(f"La respuesta de Horizons no contiene muestras parseables para {target} ({label}).")

    return rows


def terrain_horizon(dem_path, site, observer_height_m):
    try:
        import numpy as np
        import rasterio
        from pyproj import Geod
        from rasterio.warp import transform

    except ImportError as error:
        raise RuntimeError("Instala las dependencias con `python -m pip install -r requirements.txt`.") from error

    radius = site["lunar_radius_m"]
    az_step = site["terrain_azimuth_step_deg"]
    distances = np.arange(site["terrain_radial_step_m"], site["terrain_radius_m"] + 1,
                          site["terrain_radial_step_m"], dtype=float)
    geod = Geod(a=radius, b=radius)
    horizons = {}

    with rasterio.open(dem_path) as dem:
        if dem.count < 1 or dem.crs is None:
            raise RuntimeError("El DEM debe tener al menos una banda y CRS definido.")

        from pyproj import CRS

        geographic_crs = CRS.from_wkt(dem.crs.to_wkt()).geodetic_crs
        if geographic_crs is None:
            raise RuntimeError("El CRS del DEM no define su marco geográfico lunar.")

        x0, y0 = transform(geographic_crs.to_wkt(), dem.crs,
                           [site["longitude_east_deg"]], [site["latitude_deg"]])
        col_f, row_f = (~dem.transform) * (x0[0], y0[0])
        col, row = int(round(col_f)), int(round(row_f))
        
        if row < 0 or col < 0 or row >= dem.height or col >= dem.width:
            raise RuntimeError("El punto configurado queda fuera de la cobertura LOLA.")

        raster = dem.read(1, masked=True)
        center = raster[row, col]

        if np.ma.is_masked(center) or not np.isfinite(center):
            raise RuntimeError("La elevación del punto observador está ausente en el DEM.")

        center_elevation = float(center)

        for azimuth in range(0, 360, az_step):
            lon, lat, _ = geod.fwd(
                np.full(distances.size, site["longitude_east_deg"]),
                np.full(distances.size, site["latitude_deg"]),
                np.full(distances.size, azimuth), distances,
            )
            xs, ys = transform(geographic_crs.to_wkt(), dem.crs, lon.tolist(), lat.tolist())
            inv = ~dem.transform
            cols = np.rint(inv.a * np.asarray(xs) + inv.b * np.asarray(ys) + inv.c).astype(int)
            rows = np.rint(inv.d * np.asarray(xs) + inv.e * np.asarray(ys) + inv.f).astype(int)
            inside = (rows >= 0) & (cols >= 0) & (rows < dem.height) & (cols < dem.width)

            if not inside.all():
                horizons[azimuth] = None
                continue

            elevations = raster[rows, cols]
            if np.ma.getmaskarray(elevations).any() or not np.isfinite(elevations).all():
                horizons[azimuth] = None
                continue

            terrain_radius = radius + np.asarray(elevations, dtype=float)
            observer_radius = radius + center_elevation + observer_height_m
            arc = distances / radius
            horizontal = terrain_radius * np.sin(arc)
            vertical = terrain_radius * np.cos(arc) - observer_radius
            angles = np.degrees(np.arctan2(vertical, horizontal))
            horizons[azimuth] = float(np.max(angles))

        dem_metadata = {
            "resolution_m": dem.res,
            "width_px": dem.width,
            "height_px": dem.height,
            "bounds_m": tuple(dem.bounds),
        }

    return horizons, center_elevation, dem_metadata

def horizon_at(horizons, azimuth, step):
    lower = int(math.floor(azimuth / step) * step) % 360
    upper = (lower + step) % 360
    a, b = horizons.get(lower), horizons.get(upper)

    if a is None or b is None:
        return None

    fraction = (azimuth - lower) % 360 / step

    return a + (b - a) * fraction


def state_for(elevation, ground):
    if ground is None:
        return "indeterminado", None

    difference = elevation - ground

    if abs(difference) < 1e-9:
        return "contacto", difference

    return ("visible" if difference > 0 else "oculto"), difference


def refine_times(samples, horizons, az_step):
    times = sorted(samples)
    refinements = set()

    for left, right in zip(times, times[1:]):
        changed = False
        for obj in TARGETS:
            if obj not in samples[left] or obj not in samples[right]:
                continue

            left_az, left_el = samples[left][obj]
            right_az, right_el = samples[right][obj]
            left_state, _ = state_for(left_el, horizon_at(horizons, left_az, az_step))
            right_state, _ = state_for(right_el, horizon_at(horizons, right_az, az_step))
            changed |= (left_state in ("visible", "oculto") and
                        right_state in ("visible", "oculto") and left_state != right_state)

        if changed:
            start, stop = left - timedelta(hours=1), right + timedelta(hours=1)
            refinements.add((start, stop))

    return refinements

def windows_for(rows, obj):
    visible = [row for row in rows if row["object"] == obj and row["state"] == "visible"]
    windows = []

    for row in visible:
        time = datetime.fromisoformat(row["time_utc"].removesuffix("Z"))
        if not windows or time - windows[-1]["end"] > timedelta(minutes=60):
            windows.append({"start": time, "end": time})
        else:
            windows[-1]["end"] = time

    return windows


def run(dem_path):
    site = read_site()
    start = datetime.fromisoformat(site["start_utc"])
    stop = start + timedelta(days=site["period_days"])
    step = f"{site['sample_step_minutes']} min"

    OUTPUT.mkdir(parents=True, exist_ok=True)

    horizons, center_elevation, dem_metadata = terrain_horizon(
        dem_path, site, site["observer_height_m"])
    altitude_m = center_elevation + site["observer_height_m"]
    samples = {}

    for name, target in TARGETS.items():
        values = api_request(target, site, altitude_m, start.strftime("%Y-%m-%d %H:%M"),
                             stop.strftime("%Y-%m-%d %H:%M"), step, "hourly")

        for time, (az, el) in values.items():
            samples.setdefault(time, {})[name] = (az, el)

    intervals = refine_times(samples, horizons, site["terrain_azimuth_step_deg"])

    for index, (lo, hi) in enumerate(sorted(intervals), 1):
        lo, hi = max(start, lo), min(stop, hi)

        for name, target in TARGETS.items():
            values = api_request(target, site, altitude_m, lo.strftime("%Y-%m-%d %H:%M"),
                                 hi.strftime("%Y-%m-%d %H:%M"),
                                 f"{site['refinement_step_minutes']} min", f"refined-{index:03d}")
            for time, (az, el) in values.items():
                samples.setdefault(time, {})[name] = (az, el)

    rows = []

    for time, objects in sorted(samples.items()):
        for name in TARGETS:
            if name not in objects:
                continue

            azimuth, elevation = objects[name]
            ground = horizon_at(horizons, azimuth, site["terrain_azimuth_step_deg"])
            state, difference = state_for(elevation, ground)
            rows.append({"time_utc": time.isoformat() + "Z", "object": name,
                         "azimuth_deg": azimuth, "object_elevation_deg": elevation,
                         "terrain_horizon_deg": ground, "difference_deg": difference,
                         "state": state})

    csv_path = OUTPUT / "visibility.csv"
    columns = ["time_utc", "object", "azimuth_deg", "object_elevation_deg",
               "terrain_horizon_deg", "difference_deg", "state"]

    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)

    lines = ["# Informe de visibilidad lunar", "", f"- Sitio: {site['name']} (ID `{site['id']}`)",
             f"- Punto: {site['latitude_deg']}° latitud, {site['longitude_east_deg']}° este",
             f"- Altura del observador: {site['observer_height_m']} m sobre el DEM; elevación local {center_elevation:.3f} m",
             f"- DEM: `{Path(dem_path).name}`, {site['dem_version']}",
             f"- Proyección: {site['dem_projection']}", f"- Referencia vertical: {site['dem_vertical_reference']}",
             f"- Resolución efectiva de raster: {dem_metadata['resolution_m']} m/píxel; tamaño {dem_metadata['width_px']} × {dem_metadata['height_px']} píxeles",
             f"- Cobertura del raster (X/Y): {dem_metadata['bounds_m']} m",
             f"- Periodo UT: {start.isoformat()} a {stop.isoformat()}",
             f"- Horizonte de terreno: radio {site['terrain_radius_m']} m, paso radial {site['terrain_radial_step_m']} m, azimut {site['terrain_azimuth_step_deg']}°",
             f"- Sectores sin cobertura completa dentro del radio: {sum(value is None for value in horizons.values())} de {len(horizons)}",
             f"- Parámetros y respuestas originales de Horizons: `data/visibility/horizons/`", "",
             f"- Coordenadas del sitio: {site['coordinate_source']}",
             f"- Modelo LOLA: {site['dem_source']}",
             "- Efemérides y marco observador: https://ssd-api.jpl.nasa.gov/doc/horizons.html", "",
             "## Ventanas visibles muestreadas", ""]
    for obj in TARGETS:
        windows = windows_for(rows, obj)
        lines.append(f"### {obj.title()}")
        lines.extend(f"- {window['start'].isoformat()} a {window['end'].isoformat()} UT" for window in windows)

        if not windows:
            lines.append("- No se encontraron muestras visibles en el periodo.")
        lines.append("")

    lines += ["Los límites son muestras discretas; las ventanas de una hora se refinan a cinco minutos cerca de cruces detectados.",
              "Estado indeterminado indica que el DEM no tiene cobertura válida en el azimut correspondiente.",
              "El producto LOLA de 5 m contiene aproximadamente 90 % de píxeles interpolados según NASA/GSFC; este cálculo no propaga la incertidumbre de elevación.",
              "La referencia vertical del GeoTIFF no se explicita por separado; se asumió que Z se mide desde el radio lunar medio al ubicar el observador en Horizons.", ""]
    (OUTPUT / "report.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"CSV: {csv_path.relative_to(ROOT)} ({len(rows)} filas)")
    print(f"Informe: {(OUTPUT / 'report.md').relative_to(ROOT)}")

def main():
    parser = argparse.ArgumentParser(description="Integra terreno LOLA y efemérides JPL Horizons.")
    parser.add_argument("--download-dem", action="store_true",
                        help="Descarga el GeoTIFF Site04 desde NASA/GSFC PGDA")
    parser.add_argument("dem", nargs="?", default=str(ROOT / "data" / "Site04_final_adj_5mpp_surf.tif"),
                        help="GeoTIFF LOLA Site04 descargado desde NASA/GSFC PGDA")
    args = parser.parse_args()

    try:
        dem_path = Path(args.dem)

        if args.download_dem:
            dem_path.parent.mkdir(parents=True, exist_ok=True)
            url = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif"
            
            with urllib.request.urlopen(url, timeout=180) as response, dem_path.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)

        run(dem_path)

    except (OSError, RuntimeError, KeyError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1)

if __name__ == "__main__":
    main()