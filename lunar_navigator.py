#!/usr/bin/env python3
"""Console tools for the Lunar Landing Site Navigator (Python standard library)."""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "data" / "apollo_sites.json"
STATES = ("visible", "hidden", "indeterminate")
REQUIRED_COLUMNS = {
    "site_id",
    "start_utc",
    "end_utc",
    "sun_azimuth_deg",
    "sun_elevation_deg",
    "horizon_elevation_deg",
}


@dataclass(frozen=True)
class Sample:
    site_id: str
    start: datetime
    end: datetime
    sun_azimuth: float | None
    sun_elevation: float | None
    horizon_elevation: float | None
    sun_source: str | None
    horizon_source: str | None

    @property
    def state(self) -> str:
        if self.sun_elevation is None or self.horizon_elevation is None:
            return "indeterminate"
        return "visible" if self.sun_elevation > self.horizon_elevation else "hidden"


def parse_utc(value: str, label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{label}: fecha inválida: {value!r}; usa ISO 8601 con zona UTC") from exc
    if parsed.tzinfo is None or parsed.utcoffset().total_seconds() != 0:
        raise ValueError(f"{label}: se requiere una fecha con zona UTC explícita")
    return parsed.astimezone(timezone.utc)


def parse_angle(value: str | None, label: str, *, optional: bool = False) -> float | None:
    if value is None or not value.strip():
        if optional:
            return None
        raise ValueError(f"Falta {label}")
    try:
        angle = float(value)
    except ValueError as exc:
        raise ValueError(f"{label} debe ser numérico: {value!r}") from exc
    if not math.isfinite(angle):
        raise ValueError(f"{label} debe ser finito")
    return angle


def load_samples(path: Path) -> dict[str, list[Sample]]:
    try:
        handle = path.open("r", encoding="utf-8-sig", newline="")
    except OSError as exc:
        raise ValueError(f"No se pudo abrir {path}: {exc}") from exc
    with handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError("Faltan columnas CSV: " + ", ".join(sorted(missing)))
        grouped: dict[str, list[Sample]] = {}
        for line, row in enumerate(reader, start=2):
            try:
                site = (row.get("site_id") or "").strip()
                if not site:
                    raise ValueError("site_id está vacío")
                start = parse_utc(row["start_utc"], "start_utc")
                end = parse_utc(row["end_utc"], "end_utc")
                if end <= start:
                    raise ValueError("end_utc debe ser posterior a start_utc")
                azimuth = parse_angle(row.get("sun_azimuth_deg"), "sun_azimuth_deg", optional=True)
                elevation = parse_angle(row.get("sun_elevation_deg"), "sun_elevation_deg", optional=True)
                horizon = parse_angle(row.get("horizon_elevation_deg"), "horizon_elevation_deg", optional=True)
                if azimuth is not None and not 0 <= azimuth < 360:
                    raise ValueError("sun_azimuth_deg debe estar en [0, 360)")
                for name, value in (("sun_elevation_deg", elevation), ("horizon_elevation_deg", horizon)):
                    if value is not None and not -90 <= value <= 90:
                        raise ValueError(f"{name} debe estar en [-90, 90]")
                grouped.setdefault(site, []).append(Sample(
                    site, start, end, azimuth, elevation, horizon,
                    (row.get("sun_source") or "").strip() or None,
                    (row.get("horizon_source") or "").strip() or None,
                ))
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Fila {line}: {exc}") from exc
    if not grouped:
        raise ValueError("El CSV no contiene muestras")
    for site, samples in grouped.items():
        samples.sort(key=lambda item: item.start)
        for previous, current in zip(samples, samples[1:]):
            if current.start < previous.end:
                raise ValueError(f"Intervalos superpuestos para {site}: {previous.start.isoformat()} y {current.start.isoformat()}")
    return grouped


def iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def seconds(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds()


def clipped_segments(samples: Iterable[Sample], start: datetime, end: datetime) -> list[dict]:
    segments = []
    cursor = start
    for sample in samples:
        left, right = max(start, sample.start), min(end, sample.end)
        if right <= left:
            continue
        if left > cursor:
            segments.append({"inicio_utc": iso(cursor), "fin_utc": iso(left), "estado": "indeterminate"})
        if left < cursor:
            raise ValueError("Se encontraron muestras superpuestas en el periodo solicitado")
        segments.append({
            "inicio_utc": iso(left),
            "fin_utc": iso(right),
            "estado": sample.state,
            "azimut_sol_deg": sample.sun_azimuth,
            "elevacion_sol_deg": sample.sun_elevation,
            "elevacion_horizonte_deg": sample.horizon_elevation,
            "fuente_sol": sample.sun_source,
            "fuente_horizonte": sample.horizon_source,
        })
        cursor = right
    if cursor < end:
        segments.append({"inicio_utc": iso(cursor), "fin_utc": iso(end), "estado": "indeterminate"})
    return segments


def summarize(name: str, segments: list[dict]) -> dict:
    totals = {state: 0.0 for state in STATES}
    for segment in segments:
        left = parse_utc(segment["inicio_utc"], "inicio_utc")
        right = parse_utc(segment["fin_utc"], "fin_utc")
        totals[segment["estado"]] += seconds(left, right)
    total = sum(totals.values())
    return {
        "sitio": name,
        "horas_visibles": round(totals["visible"] / 3600, 6),
        "horas_ocultas": round(totals["hidden"] / 3600, 6),
        "horas_indeterminadas": round(totals["indeterminate"] / 3600, 6),
        "interrupciones": sum(
            segment["estado"] == "hidden" and (index == 0 or segments[index - 1]["estado"] != "hidden")
            for index, segment in enumerate(segments)
        ),
        "intervalos": segments,
        "duracion_total_segundos": total,
    }


def joint_visible_seconds(left: list[dict], right: list[dict]) -> float:
    total = 0.0
    i = j = 0
    while i < len(left) and j < len(right):
        a, b = left[i], right[j]
        start = max(parse_utc(a["inicio_utc"], "inicio_utc"), parse_utc(b["inicio_utc"], "inicio_utc"))
        end = min(parse_utc(a["fin_utc"], "fin_utc"), parse_utc(b["fin_utc"], "fin_utc"))
        if end > start and a["estado"] == "visible" and b["estado"] == "visible":
            total += seconds(start, end)
        if parse_utc(a["fin_utc"], "fin_utc") <= parse_utc(b["fin_utc"], "fin_utc"):
            i += 1
        else:
            j += 1
    return total


def report(mode: str, reports: list[dict], coincidence: float, coincidence_label: str, csv_path: Path) -> dict:
    return {
        "producto": "Lunar Landing Site Navigator",
        "modo": mode,
        "insumo_csv": str(csv_path.resolve()),
        "coincidencia": {"descripcion": coincidence_label, "horas": round(coincidence / 3600, 6)},
        "resultados": reports,
        "metodo": "visible si elevacion_sol_deg > elevacion_horizonte_deg; la igualdad es oculta; faltantes y huecos son indeterminados",
    }


def load_catalog() -> dict:
    try:
        return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"No se pudo leer el catálogo {CATALOG_PATH}: {exc}") from exc


def command_catalog(args: argparse.Namespace) -> None:
    catalog = load_catalog()
    missions = catalog["missions"]
    if args.action == "list":
        for mission in missions:
            print(f"{mission['id']}: {mission['site_name']} ({mission['landing_time_utc']} UTC)")
        return
    match = next((mission for mission in missions if mission["id"].casefold() == args.mission.casefold()), None)
    if match is None:
        raise ValueError(f"Misión desconocida: {args.mission}. Usa 'catalog list'.")
    print(json.dumps(match, ensure_ascii=False, indent=2))


def check_range(start: datetime, end: datetime, label: str) -> None:
    if end <= start:
        raise ValueError(f"{label}: el final debe ser posterior al inicio")


def command_compare_sites(args: argparse.Namespace) -> None:
    samples = load_samples(Path(args.csv))
    if args.site_a not in samples or args.site_b not in samples:
        raise ValueError(f"Sitio no encontrado en CSV. Disponibles: {', '.join(sorted(samples))}")
    start, end = parse_utc(args.start, "--start"), parse_utc(args.end, "--end")
    check_range(start, end, "Periodo")
    a = clipped_segments(samples[args.site_a], start, end)
    b = clipped_segments(samples[args.site_b], start, end)
    coincidence = joint_visible_seconds(a, b)
    output = report("dos_sitios_mismo_periodo", [summarize(args.site_a, a), summarize(args.site_b, b)], coincidence, "ambos sitios visibles simultáneamente", Path(args.csv))
    print(json.dumps(output, ensure_ascii=False, indent=2))


def offset_segments(segments: list[dict], origin: datetime) -> list[dict]:
    """Map a period onto an elapsed-time axis so equal-duration ranges can be compared."""
    mapped = []
    for segment in segments:
        left = seconds(origin, parse_utc(segment["inicio_utc"], "inicio_utc"))
        right = seconds(origin, parse_utc(segment["fin_utc"], "fin_utc"))
        mapped.append({"inicio_utc": str(left), "fin_utc": str(right), "estado": segment["estado"]})
    return mapped


def overlap_offset_seconds(left: list[dict], right: list[dict]) -> float:
    total = 0.0
    for a in left:
        for b in right:
            start = max(float(a["inicio_utc"]), float(b["inicio_utc"]))
            end = min(float(a["fin_utc"]), float(b["fin_utc"]))
            if end > start and a["estado"] == b["estado"] == "visible":
                total += end - start
    return total


def command_compare_periods(args: argparse.Namespace) -> None:
    samples = load_samples(Path(args.csv))
    if args.site not in samples:
        raise ValueError(f"Sitio no encontrado en CSV. Disponibles: {', '.join(sorted(samples))}")
    start_a, end_a = parse_utc(args.start_a, "--start-a"), parse_utc(args.end_a, "--end-a")
    start_b, end_b = parse_utc(args.start_b, "--start-b"), parse_utc(args.end_b, "--end-b")
    check_range(start_a, end_a, "Periodo A")
    check_range(start_b, end_b, "Periodo B")
    duration_a, duration_b = seconds(start_a, end_a), seconds(start_b, end_b)
    if not math.isclose(duration_a, duration_b, abs_tol=1e-6):
        raise ValueError("Los dos periodos deben tener exactamente la misma duración")
    seg_a = clipped_segments(samples[args.site], start_a, end_a)
    seg_b = clipped_segments(samples[args.site], start_b, end_b)
    coincidence = overlap_offset_seconds(offset_segments(seg_a, start_a), offset_segments(seg_b, start_b))
    output = report("un_sitio_dos_periodos", [summarize(args.site + " / periodo A", seg_a), summarize(args.site + " / periodo B", seg_b)], coincidence, "ambos periodos visibles en el mismo tiempo transcurrido", Path(args.csv))
    print(json.dumps(output, ensure_ascii=False, indent=2))


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Catálogo Apollo y comparación de ventanas de visibilidad lunar.")
    commands = result.add_subparsers(dest="command", required=True)
    catalog = commands.add_parser("catalog", help="Consultar el catálogo histórico Apollo")
    actions = catalog.add_subparsers(dest="action", required=True)
    actions.add_parser("list", help="Listar misiones")
    show = actions.add_parser("show", help="Mostrar la ficha de una misión")
    show.add_argument("mission", help="ID de misión, por ejemplo apollo-11")
    catalog.set_defaults(func=command_catalog)

    sites = commands.add_parser("compare-sites", help="Comparar dos sitios en el mismo periodo")
    sites.add_argument("--csv", required=True, help="CSV con muestras de ambos sitios")
    sites.add_argument("--site-a", required=True)
    sites.add_argument("--site-b", required=True)
    sites.add_argument("--start", required=True, help="Inicio UTC ISO 8601")
    sites.add_argument("--end", required=True, help="Fin UTC ISO 8601")
    sites.set_defaults(func=command_compare_sites)

    periods = commands.add_parser("compare-periods", help="Comparar dos periodos iguales para un sitio")
    periods.add_argument("--csv", required=True, help="CSV con muestras del sitio")
    periods.add_argument("--site", required=True)
    periods.add_argument("--start-a", required=True, help="Inicio UTC ISO 8601 del periodo A")
    periods.add_argument("--end-a", required=True, help="Fin UTC ISO 8601 del periodo A")
    periods.add_argument("--start-b", required=True, help="Inicio UTC ISO 8601 del periodo B")
    periods.add_argument("--end-b", required=True, help="Fin UTC ISO 8601 del periodo B")
    periods.set_defaults(func=command_compare_periods)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        args.func(args)
    except (ValueError, KeyError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
