"""Compara métricas de visibilidad entre sitios o periodos de la etapa 3."""

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "data" / "visibility" / "sites"
OUTPUT = ROOT / "data" / "visibility" / "comparisons"
OBJECTS = ("sun", "earth")


def parse_time(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"Fecha/hora inválida `{value}`; usa YYYY-MM-DD o ISO 8601 UTC.") from error
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def load_site(site_id):
    if Path(site_id).name != site_id or site_id in (".", ".."):
        raise ValueError(f"ID de sitio inválido: `{site_id}`.")
    path = RESULTS / site_id / "analysis.json"
    if not path.is_file():
        available = sorted(p.parent.name for p in RESULTS.glob("*/analysis.json"))
        raise ValueError(f"No hay resultados para `{site_id}`. Sitios disponibles: {', '.join(available)}")
    result = json.loads(path.read_text(encoding="utf-8"))
    return result, path


def clip_intervals(intervals, start, end):
    clipped = []
    for interval in intervals:
        interval_start = parse_time(interval["start"])
        interval_end = parse_time(interval["end"])
        if interval["state"] == "contacto":
            if start <= interval_start < end:
                clipped.append({**interval, "start": interval_start, "end": interval_end,
                                "duration_hours": 0.0,
                                "touches_period_start": interval_start == start,
                                "touches_period_end": interval_start == end})
            continue
        clip_start, clip_end = max(start, interval_start), min(end, interval_end)
        if clip_end <= clip_start:
            continue
        clipped.append({**interval, "start": clip_start, "end": clip_end,
                        "duration_hours": (clip_end - clip_start).total_seconds() / 3600,
                        "touches_period_start": clip_start == start,
                        "touches_period_end": clip_end == end})
    return sorted(clipped, key=lambda item: (item["start"], item["end"]))


def intersect_hours(first, second):
    left = [i for i in first if i["state"] == "visible" and i["end"] > i["start"]]
    right = [i for i in second if i["state"] == "visible" and i["end"] > i["start"]]
    i = j = 0
    total = 0.0
    while i < len(left) and j < len(right):
        overlap_start = max(left[i]["start"], right[j]["start"])
        overlap_end = min(left[i]["end"], right[j]["end"])
        if overlap_end > overlap_start:
            total += (overlap_end - overlap_start).total_seconds() / 3600
        if left[i]["end"] <= right[j]["end"]:
            i += 1
        else:
            j += 1
    return total


def metrics_for(intervals):
    by_object = {}
    for obj in OBJECTS:
        rows = [interval for interval in intervals if interval["object"] == obj]
        occluded = [i for i in rows if i["state"] == "oculto"]
        longest = max(occluded, key=lambda i: i["duration_hours"], default=None)
        by_object[obj] = {
            "hours_visible": round(sum(i["duration_hours"] for i in rows if i["state"] == "visible"), 6),
            "maximum_continuous_occluded_hours": round(longest["duration_hours"], 6) if longest else 0.0,
            "longest_occluded_interval": ({
                "start_utc": longest["start"].isoformat() + "Z",
                "end_utc": longest["end"].isoformat() + "Z",
                "touches_period_start": longest["touches_period_start"],
                "touches_period_end": longest["touches_period_end"],
                "stage3_boundary_limited_start": longest.get("boundary_limited_start", False),
                "stage3_boundary_limited_end": longest.get("boundary_limited_end", False),
                "start_precision_minutes": longest.get("start_precision_minutes"),
                "end_precision_minutes": longest.get("end_precision_minutes"),
            } if longest else None),
            "hours_indeterminate": round(sum(i["duration_hours"] for i in rows if i["state"] == "indeterminado"), 6),
            "contact_events": sum(i["state"] == "contacto" for i in rows),
        }
    by_object["hours_simultaneously_visible"] = round(
        intersect_hours([i for i in intervals if i["object"] == "sun"],
                        [i for i in intervals if i["object"] == "earth"]), 6)
    return by_object


def scenario(site_data, source_path, start, end, label):
    config = site_data["configuration"]
    available_start, available_end = parse_time(config["start_utc"]), parse_time(config["end_utc"])
    if start >= end:
        raise ValueError(f"El rango {label} debe tener inicio anterior al fin.")
    if start < available_start or end > available_end:
        raise ValueError(f"El rango {label} ({start.isoformat()} a {end.isoformat()}) excede la cobertura disponible "
                         f"({available_start.isoformat()} a {available_end.isoformat()} UT).")
    source_intervals = site_data["intervals"]
    clipped = [item for obj in OBJECTS for item in clip_intervals(
        [i for i in source_intervals if i["object"] == obj], start, end)]
    samples = site_data["samples"]
    inferred_gaps = {obj: 0.0 for obj in OBJECTS}
    for obj in OBJECTS:
        object_samples = sorted((row for row in samples if row["object"] == obj),
                                key=lambda row: row["time_utc"])
        times = [parse_time(row["time_utc"]) for row in object_samples]
        if not times or times[0] > start or times[-1] < end:
            raise ValueError(f"Faltan muestras de {obj} para cubrir todo el rango {label}.")
        max_step = config["sample_step_minutes"]
        for left, right in zip(times, times[1:]):
            if right - left <= timedelta(minutes=max_step):
                continue
            gap_start, gap_end = max(start, left), min(end, right)
            if gap_end > gap_start:
                known = sorted((i["start"], i["end"]) for i in clipped
                               if i["object"] == obj and i["state"] == "indeterminado" and
                               i["end"] > gap_start and i["start"] < gap_end)
                uncovered, cursor = [], gap_start
                for known_start, known_end in known:
                    if known_start > cursor:
                        uncovered.append((cursor, min(known_start, gap_end)))
                    cursor = max(cursor, known_end)
                if cursor < gap_end:
                    uncovered.append((cursor, gap_end))
                for unknown_start, unknown_end in uncovered:
                    hours = (unknown_end - unknown_start).total_seconds() / 3600
                    inferred_gaps[obj] += hours
                    clipped.append({"object": obj, "state": "indeterminado", "start": unknown_start,
                                    "end": unknown_end, "duration_hours": hours,
                                    "touches_period_start": unknown_start == start,
                                    "touches_period_end": unknown_end == end,
                                    "boundary_limited_start": False, "boundary_limited_end": False})
    metrics = metrics_for(clipped)
    return {
        "label": label,
        "site_id": site_data["site"]["id"],
        "site_name": site_data["site"]["name"],
        "site_coordinates": {key: site_data["site"][key] for key in
                              ("latitude_deg", "longitude_east_deg", "coordinate_frame", "coordinate_source")},
        "range_utc": {"start_inclusive": start.isoformat() + "Z", "end_exclusive": end.isoformat() + "Z",
                      "duration_hours": (end - start).total_seconds() / 3600},
        "metrics": metrics,
        "coverage": {
            "available_start_utc": config["start_utc"],
            "available_end_utc": config["end_utc"],
            "terrain_sectors_without_complete_profile": site_data["terrain"]["coverage_sectors_without_complete_profile"],
            "terrain_analysis_radius_m": site_data["terrain"]["analysis_radius_m"],
            "terrain_resolution_m": site_data["terrain"]["resolution_m"],
            "terrain_projection": site_data["terrain"]["projection"],
            "terrain_vertical_reference": site_data["terrain"]["vertical_reference"],
            "inferred_missing_sample_hours": {obj: round(value, 6) for obj, value in inferred_gaps.items()},
            "dem_file": site_data["terrain"]["file"],
            "dem_source": site_data["terrain"]["source"],
            "horizons_documentation": site_data["provenance"]["horizons_documentation"],
            "analysis_json": str(source_path.relative_to(ROOT)),
            "horizons_raw_responses": site_data["provenance"]["horizons_raw_responses"],
        },
    }


def metric_differences(a, b):
    differences = {}
    for obj in OBJECTS:
        for metric in ("hours_visible", "maximum_continuous_occluded_hours",
                       "hours_indeterminate", "contact_events"):
            differences[f"{obj}.{metric}"] = round(b["metrics"][obj][metric] - a["metrics"][obj][metric], 6)
    differences["hours_simultaneously_visible"] = round(
        b["metrics"]["hours_simultaneously_visible"] -
        a["metrics"]["hours_simultaneously_visible"], 6)
    return differences


def render_report(comparison):
    a, b = comparison["scenarios"]["A"], comparison["scenarios"]["B"]
    mode_label = "sitios" if comparison["mode"] == "sites" else "fechas"
    lines = [f"# Comparación de {mode_label}", "",
             f"- Escenario A: `{a['site_id']}` ({a['site_name']}), {a['range_utc']['start_inclusive']} a {a['range_utc']['end_exclusive']} (fin exclusivo).",
             f"- Escenario B: `{b['site_id']}` ({b['site_name']}), {b['range_utc']['start_inclusive']} a {b['range_utc']['end_exclusive']} (fin exclusivo).",
             "- Tiempos en UTC; duración basada en los intervalos muestreados de la etapa 3, recortados al rango solicitado.", "",
             "| Métrica | A | B | B − A |", "|---|---:|---:|---:|"]
    metrics = [
        ("Horas con Sol visible", "sun", "hours_visible"),
        ("Horas con Tierra visible", "earth", "hours_visible"),
        ("Mayor ocultamiento continuo del Sol (h)", "sun", "maximum_continuous_occluded_hours"),
        ("Mayor ocultamiento continuo de la Tierra (h)", "earth", "maximum_continuous_occluded_hours"),
        ("Tiempo indeterminado del Sol (h)", "sun", "hours_indeterminate"),
        ("Tiempo indeterminado de la Tierra (h)", "earth", "hours_indeterminate"),
        ("Contactos del Sol", "sun", "contact_events"),
        ("Contactos de la Tierra", "earth", "contact_events"),
    ]
    for label, obj, key in metrics:
        value_a, value_b = a["metrics"][obj][key], b["metrics"][obj][key]
        lines.append(f"| {label} | {value_a} | {value_b} | {value_b - value_a:.6f} |")
    value_a = a["metrics"]["hours_simultaneously_visible"]
    value_b = b["metrics"]["hours_simultaneously_visible"]
    lines.append(f"| Horas con Sol y Tierra visibles a la vez | {value_a} | {value_b} | {value_b - value_a:.6f} |")
    lines += ["", "## Interrupción máxima y límites", ""]
    for label, case in (("A", a), ("B", b)):
        for obj in OBJECTS:
            interval = case["metrics"][obj]["longest_occluded_interval"]
            if interval:
                lines.append(f"- {label}, {obj}: {interval['start_utc']} a {interval['end_utc']}; "
                             f"toca inicio={interval['touches_period_start']}, fin={interval['touches_period_end']}; "
                             f"precisión de límites {interval['start_precision_minutes']}/{interval['end_precision_minutes']} min.")
            else:
                lines.append(f"- {label}, {obj}: sin intervalos ocultos.")
    lines += ["", "## Cobertura y procedencia", ""]
    for label, case in (("A", a), ("B", b)):
        cov = case["coverage"]
        json_link = f"../sites/{case['site_id']}/analysis.json"
        coords = case["site_coordinates"]
        lines.append(f"- {label}: {coords['latitude_deg']}°, {coords['longitude_east_deg']}° E ({coords['coordinate_frame']}); "
                     f"{cov['terrain_sectors_without_complete_profile']} sectores LOLA incompletos en radio {cov['terrain_analysis_radius_m']} m, "
                     f"resolución {cov['terrain_resolution_m']} m; DEM `{cov['dem_file']}` ([fuente]({cov['dem_source']})); "
                     f"coordenadas ([fuente]({coords['coordinate_source']})); resultados [JSON]({json_link}).")
        lines.append(f"  Cobertura temporal: {cov['available_start_utc']} a {cov['available_end_utc']} UT.")
        gaps = cov["inferred_missing_sample_hours"]
        lines.append(f"  Huecos de muestreo añadidos como indeterminados: Sol {gaps['sun']} h, Tierra {gaps['earth']} h.")
        lines.append(f"  Respuestas Horizons guardadas: `{len(cov['horizons_raw_responses'])}` archivos; documentación {cov['horizons_documentation']}.")
    lines += ["", "La duración máxima se calcula sobre intervalos ocultos individuales; no se unen a través de tramos indeterminados.",
              "Si el mayor intervalo toca el inicio o fin solicitado, su duración está recortada y el ocultamiento puede continuar fuera del periodo.",
              "La visibilidad corresponde al centro geométrico del objeto, según el cálculo de la etapa 3.", ""]
    return "\n".join(lines)


def execute(mode, site_ids, ranges, output_name=None):
    scenarios = {}
    for label, site_id, start, end in ranges:
        data, path = load_site(site_id)
        scenarios[label] = scenario(data, path, start, end, label)
    if mode == "dates" and scenarios["A"]["range_utc"]["duration_hours"] != scenarios["B"]["range_utc"]["duration_hours"]:
        raise ValueError("En la comparación de fechas, los dos periodos deben tener la misma duración.")
    result = {"schema_version": 1, "mode": mode, "scenarios": scenarios,
              "difference_b_minus_a": metric_differences(scenarios["A"], scenarios["B"])}
    if output_name is None:
        safe = "-".join([mode, *(item for item in site_ids),
                        scenarios["A"]["range_utc"]["start_inclusive"][:10],
                        scenarios["B"]["range_utc"]["start_inclusive"][:10]])
        output_name = safe
    if Path(output_name).name != output_name or not re.fullmatch(r"[A-Za-z0-9_-]+", output_name):
        raise ValueError("El nombre de salida solo puede contener letras, números, guiones y guiones bajos.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    json_path, report_path = OUTPUT / f"{output_name}.json", OUTPUT / f"{output_name}.md"
    result["text_report"] = str(report_path.relative_to(ROOT))
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path.write_text(render_report(result), encoding="utf-8")
    print(f"JSON: {json_path.relative_to(ROOT)}")
    print(f"Reporte: {report_path.relative_to(ROOT)}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Compara visibilidad solar y terrestre de la etapa 3.")
    commands = parser.add_subparsers(dest="mode", required=True)
    sites = commands.add_parser("sites", help="Compara dos sitios durante el mismo periodo")
    sites.add_argument("site_a")
    sites.add_argument("site_b")
    sites.add_argument("--start", required=True, help="Inicio UTC inclusivo, YYYY-MM-DD")
    sites.add_argument("--end", required=True, help="Fin UTC exclusivo, YYYY-MM-DD")
    sites.add_argument("--output-name", help="Nombre base opcional para los archivos JSON y Markdown")
    dates = commands.add_parser("dates", help="Compara dos periodos de igual duración en un sitio")
    dates.add_argument("site")
    for suffix in ("a", "b"):
        dates.add_argument(f"--start-{suffix}", required=True, help=f"Inicio UTC del periodo {suffix.upper()}, YYYY-MM-DD")
        dates.add_argument(f"--end-{suffix}", required=True, help=f"Fin UTC exclusivo del periodo {suffix.upper()}, YYYY-MM-DD")
    dates.add_argument("--output-name", help="Nombre base opcional para los archivos JSON y Markdown")
    args = parser.parse_args()
    try:
        if args.mode == "sites":
            start, end = parse_time(args.start), parse_time(args.end)
            ranges = [("A", args.site_a, start, end), ("B", args.site_b, start, end)]
            execute("sites", [args.site_a, args.site_b], ranges, args.output_name)
        else:
            start_a, end_a = parse_time(args.start_a), parse_time(args.end_a)
            start_b, end_b = parse_time(args.start_b), parse_time(args.end_b)
            ranges = [("A", args.site, start_a, end_a), ("B", args.site, start_b, end_b)]
            execute("dates", [args.site], ranges, args.output_name)
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
