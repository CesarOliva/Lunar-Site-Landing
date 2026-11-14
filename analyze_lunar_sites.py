"""Procesa y compara tres puntos de análisis del polo sur lunar."""

import argparse
import csv
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from visibility import (OUTPUT, ROOT, TARGETS, api_request, horizon_at,
                        refine_times, state_for, terrain_horizon)

REGISTRY = ROOT / "data" / "visibility-sites.json"
RESULTS = OUTPUT / "sites"
CSV_COLUMNS = ["site_id", "time_utc", "object", "azimuth_deg",
               "object_elevation_deg", "terrain_horizon_deg", "difference_deg", "state",
               "horizon_profile_azimuths_deg", "horizons_source"]


def intervals_for(rows, obj, period_start, period_end, maximum_gap_minutes=60):
    selected = sorted((row for row in rows if row["object"] == obj), key=lambda row: row["time_utc"])
    groups = []
    for index, row in enumerate(selected):
        time = datetime.fromisoformat(row["time_utc"].removesuffix("Z"))
        if (not groups or groups[-1]["state"] != row["state"] or
                time - groups[-1]["end"] > timedelta(minutes=maximum_gap_minutes)):
            groups.append({"object": obj, "state": row["state"], "start": time,
                           "end": time, "first_index": index, "last_index": index})
        else:
            groups[-1]["end"] = time
            groups[-1]["last_index"] = index
    intervals = []
    for group in groups:
        first, last = group.pop("first_index"), group.pop("last_index")
        start, end = group["start"], group["end"]
        start_limited, end_limited = start == period_start, end == period_end
        previous = (datetime.fromisoformat(selected[first - 1]["time_utc"].removesuffix("Z"))
                    if first else None)
        following = (datetime.fromisoformat(selected[last + 1]["time_utc"].removesuffix("Z"))
                     if last + 1 < len(selected) else None)
        start_precision = (0 if start_limited else
                           round((start - previous).total_seconds() / 60) if previous else maximum_gap_minutes)
        end_precision = (0 if end_limited else
                         round((following - end).total_seconds() / 60) if following else maximum_gap_minutes)
        intervals.append({**group, "start": start.isoformat() + "Z", "end": end.isoformat() + "Z",
                          "boundary_limited_start": start_limited,
                          "boundary_limited_end": end_limited,
                          "start_precision_minutes": start_precision,
                          "end_precision_minutes": end_precision})
    return intervals


def start_end(common):
    return (datetime.fromisoformat(common["start_utc"]) +
            timedelta(days=common["period_days"])).isoformat()


def analyze_site(site_entry, common, dem_path):
    site = {**common, **site_entry, "kind": "polar_analysis_site"}
    out_dir = RESULTS / site["id"]
    raw_dir = out_dir / "horizons"
    out_dir.mkdir(parents=True, exist_ok=True)
    start = datetime.fromisoformat(site["start_utc"])
    stop = start + timedelta(days=site["period_days"])
    horizons, center_elevation, dem_metadata = terrain_horizon(
        dem_path, site, site["observer_height_m"])
    altitude_m = center_elevation + site["observer_height_m"]
    samples = {}
    sample_sources = {}
    step = f"{site['sample_step_minutes']} min"

    for name, target in TARGETS.items():
        values = api_request(target, site, altitude_m, start.strftime("%Y-%m-%d %H:%M"),
                             stop.strftime("%Y-%m-%d %H:%M"), step,
                             f"{site['id']}-hourly", raw_dir)
        for time, (azimuth, elevation) in values.items():
            samples.setdefault(time, {})[name] = (azimuth, elevation)
            sample_sources[(time, name)] = str((raw_dir / f"{site['id']}-hourly-{target}.json").relative_to(ROOT))

    refinements = refine_times(samples, horizons, site["terrain_azimuth_step_deg"])
    for index, (left, right) in enumerate(sorted(refinements), 1):
        left, right = max(start, left), min(stop, right)
        for name, target in TARGETS.items():
            label = f"{site['id']}-refined-{index:03d}"
            values = api_request(
                target, site, altitude_m, left.strftime("%Y-%m-%d %H:%M"),
                right.strftime("%Y-%m-%d %H:%M"),
                f"{site['refinement_step_minutes']} min",
                label, raw_dir)
            for time, (azimuth, elevation) in values.items():
                samples.setdefault(time, {})[name] = (azimuth, elevation)
                sample_sources[(time, name)] = str((raw_dir / f"{label}-{target}.json").relative_to(ROOT))

    rows = []
    for time, objects in sorted(samples.items()):
        for name, (azimuth, elevation) in objects.items():
            ground = horizon_at(horizons, azimuth, site["terrain_azimuth_step_deg"])
            state, difference = state_for(elevation, ground)
            left_azimuth = int(azimuth // site["terrain_azimuth_step_deg"] * site["terrain_azimuth_step_deg"] % 360)
            right_azimuth = (left_azimuth + site["terrain_azimuth_step_deg"]) % 360
            rows.append({"site_id": site["id"], "time_utc": time.isoformat() + "Z",
                         "object": name, "azimuth_deg": azimuth,
                         "object_elevation_deg": elevation,
                         "terrain_horizon_deg": ground, "difference_deg": difference,
                         "state": state,
                         "horizon_profile_azimuths_deg": [left_azimuth, right_azimuth],
                         "horizons_source": sample_sources[(time, name)]})

    intervals = [interval for obj in TARGETS for interval in intervals_for(
        rows, obj, start, stop, site["sample_step_minutes"])]
    raw_files = sorted(str(path.relative_to(ROOT)) for path in raw_dir.glob("*.json"))
    horizon_profile = [{"azimuth_deg": azimuth, "terrain_horizon_deg": angle}
                       for azimuth, angle in sorted(horizons.items())]
    dem_info = {
        "file": Path(dem_path).name,
        "source": site["dem_source"],
        "version": site["dem_version"],
        "projection": site["dem_projection"],
        "vertical_reference": site["dem_vertical_reference"],
        "resolution_m": list(dem_metadata["resolution_m"]),
        "coverage_bounds_xy_m": list(dem_metadata["bounds_m"]),
        "coverage_sectors_without_complete_profile": sum(x["terrain_horizon_deg"] is None for x in horizon_profile),
        "analysis_radius_m": site["terrain_radius_m"],
        "radial_step_m": site["terrain_radial_step_m"],
        "azimuth_step_deg": site["terrain_azimuth_step_deg"],
        "observer_local_elevation_m": center_elevation,
        "observer_height_above_terrain_m": site["observer_height_m"],
    }
    provenance = {
        "coordinates_source": site["coordinate_source"],
        "coordinates_note": site["coordinate_note"],
        "horizons_documentation": "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
        "horizons_raw_responses": raw_files,
        "horizons_frame_check": "MEAN_ME, lunar radii 1737.4 km, requested longitude/latitude/altitude checked against response header",
        "horizontal_angles": "apparent center, AIRLESS, azimuth clockwise from north",
    }
    result = {
        "schema_version": 1,
        "site": {key: site[key] for key in (
            "id", "kind", "name", "latitude_deg", "longitude_east_deg",
            "coordinate_frame", "coordinate_source", "coordinate_note", "offset_from_base_m",
            "bearing_from_base_deg")},
        "configuration": {key: site[key] for key in (
            "start_utc", "period_days", "sample_step_minutes", "refinement_step_minutes",
            "observer_height_m", "terrain_radius_m", "terrain_radial_step_m",
            "terrain_azimuth_step_deg", "lunar_radius_m")},
        "terrain": dem_info,
        "provenance": provenance,
        "terrain_horizon_profile": horizon_profile,
        "samples": rows,
        "intervals": intervals,
    }
    result["configuration"]["end_utc"] = stop.isoformat()
    result["configuration"]["time_scale"] = "UT"
    json_path = out_dir / "analysis.json"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    csv_path = out_dir / "visibility.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return result, rows


def find_contrast(results):
    site_rows = {result["site"]["id"]: {
        row["time_utc"]: row for row in result["samples"]
        if row["object"] == "sun" and row["state"] in ("visible", "oculto")
    } for result in results}
    best = None
    best_margin = -1
    site_ids = list(site_rows)
    for i, first_id in enumerate(site_ids):
        for second_id in site_ids[i + 1:]:
            for time in sorted(site_rows[first_id].keys() & site_rows[second_id].keys()):
                a, b = site_rows[first_id][time], site_rows[second_id][time]
                if {a["state"], b["state"]} == {"visible", "oculto"}:
                    visible = a if a["state"] == "visible" else b
                    hidden = b if a["state"] == "visible" else a
                    margin = min(visible["difference_deg"], -hidden["difference_deg"])
                    if margin > best_margin:
                        best_margin = margin
                        best = {"object": "sun", "time_utc": time,
                                "visible_site": visible["site_id"],
                                "visible_sample": visible,
                                "hidden_site": hidden["site_id"],
                                "hidden_sample": hidden,
                                "minimum_separation_margin_deg": margin,
                                "rule": "elevation - terrain_horizon; positive visible, negative occluded"}
    return best


def main():
    parser = argparse.ArgumentParser(description="Procesa los sitios de análisis de la etapa 3.")
    parser.add_argument("--dem", default=str(ROOT / "data" / "Site04_final_adj_5mpp_surf.tif"))
    parser.add_argument("--registry", default=str(REGISTRY))
    args = parser.parse_args()
    try:
        registry_path = Path(args.registry)
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        common_path = ROOT / registry["common_config"]
        common = json.loads(common_path.read_text(encoding="utf-8"))
        entries = registry["sites"]
        if len(entries) != 3 or len({site["id"] for site in entries}) != 3:
            raise ValueError("El registro debe contener exactamente tres IDs únicos.")
        RESULTS.mkdir(parents=True, exist_ok=True)
        results, combined_rows = [], []
        for entry in entries:
            result, rows = analyze_site(entry, common, Path(args.dem))
            results.append(result)
            combined_rows.extend(rows)
            print(f"{entry['id']}: {len(rows)} muestras — {RESULTS / entry['id'] / 'analysis.json'}")

        csv_path = RESULTS / "all-sites.csv"
        with csv_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            writer.writerows(combined_rows)

        contrast = find_contrast(results)
        contrast_path = RESULTS / "comparison-example.json"
        if contrast:
            contrast_path.write_text(json.dumps(contrast, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Contraste solar: {contrast['visible_site']} visible / {contrast['hidden_site']} oculto en {contrast['time_utc']}")
        else:
            contrast_path.write_text(json.dumps({"contrast_found": False,
                "note": "No hubo una muestra temporal compartida con estados solares opuestos."},
                ensure_ascii=False, indent=2), encoding="utf-8")
            print("No se encontró un instante común con contraste visible/oculto.")
        report = ["# Etapa 3: comparación de tres puntos del polo sur lunar", "",
                  f"- Periodo común UT: {common['start_utc']} a {start_end(common)}",
                  f"- Paso inicial: {common['sample_step_minutes']} min; refinamiento: {common['refinement_step_minutes']} min",
                  f"- Altura de observador: {common['observer_height_m']} m sobre el terreno",
                  f"- Modelo: {common['dem_version']}; radio de terreno: {common['terrain_radius_m']} m",
                  "- Los dos puntos adicionales se derivan geodésicamente del centro Site04 publicado; no son sitios oficiales de aterrizaje.", ""]
        for result in results:
            site = result["site"]
            report += [f"## {site['name']} (`{site['id']}`)",
                       f"- Coordenadas: {site['latitude_deg']}, {site['longitude_east_deg']}° E ({site['coordinate_frame']})",
                       f"- Origen de coordenadas: {site['coordinate_note']} — {site['coordinate_source']}",
                       f"- Elevación local LOLA: {result['terrain']['observer_local_elevation_m']:.3f} m; píxel {result['terrain']['resolution_m']} m; sectores incompletos {result['terrain']['coverage_sectors_without_complete_profile']}/360",
                       f"- Terreno: {result['terrain']['source']}; Horizons: {result['provenance']['horizons_documentation']}",
                       f"- Muestras: {len(result['samples'])}; configuración, perfil, muestras e intervalos: `data/visibility/sites/{site['id']}/analysis.json`",
                       f"- Respuestas originales Horizons: `data/visibility/sites/{site['id']}/horizons/`", ""]
            for obj in TARGETS:
                counts = {}
                for sample in result["samples"]:
                    if sample["object"] == obj:
                        counts[sample["state"]] = counts.get(sample["state"], 0) + 1
                report.append(f"- {obj.title()}: " + ", ".join(f"{state} {count}" for state, count in sorted(counts.items())))
                visible = [interval for interval in result["intervals"]
                           if interval["object"] == obj and interval["state"] == "visible"]
                report.extend(f"  - Ventana visible muestreada: {item['start']} a {item['end']} UT" for item in visible)
            report.append("")
        report += ["## Caso de contraste", ""]
        if contrast:
            a, b = contrast["visible_sample"], contrast["hidden_sample"]
            report += [f"En {contrast['time_utc']}, el centro del Sol resulta visible desde `{a['site_id']}` y oculto desde `{b['site_id']}`.",
                       f"- Visible: azimut {a['azimuth_deg']:.6f}°, elevación {a['object_elevation_deg']:.6f}°, horizonte {a['terrain_horizon_deg']:.6f}°, diferencia {a['difference_deg']:.6f}°.",
                       f"- Oculto: azimut {b['azimuth_deg']:.6f}°, elevación {b['object_elevation_deg']:.6f}°, horizonte {b['terrain_horizon_deg']:.6f}°, diferencia {b['difference_deg']:.6f}°.",
                       "- Datos trazables en `comparison-example.json`, los JSON por sitio y las respuestas Horizons guardadas.", ""]
        else:
            report += ["No se encontró contraste visible/oculto entre sitios en una hora compartida; revisar `comparison-example.json`.", ""]
        report += ["## Límites del modelo", "",
                   "El producto LOLA de 5 m tiene aproximadamente 90 % de píxeles interpolados según NASA/GSFC; estas salidas no propagan la incertidumbre vertical.",
                   "El GeoTIFF no declara un datum vertical por separado; para la altura del observador se asume Z respecto al radio medio lunar de 1.737.400 m.",
                   f"CSV con todas las muestras: `{csv_path.relative_to(ROOT)}`", ""]
        report_path = RESULTS / "report.md"
        report_path.write_text("\n".join(report), encoding="utf-8")
        print(f"Informe común: {report_path}")
        print(f"CSV común: {csv_path}")
        print(f"Caso de comparación: {contrast_path}")
    except (OSError, json.JSONDecodeError, RuntimeError, KeyError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
