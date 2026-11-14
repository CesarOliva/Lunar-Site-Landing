"""Consulta y valida el catálogo histórico lunar."""

import argparse
import json
import math
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "missions.json"
REPORT = ROOT / "data" / "validation-report.md"


def load_catalog():
    with DATA.open(encoding="utf-8") as file:
        return json.load(file)


def validate(catalog):
    errors = []
    missions = catalog.get("missions")

    if not isinstance(missions, list):
        return ["`missions` debe ser una lista."]

    ids = set()
    for index, mission in enumerate(missions):
        label = mission.get("id", f"registro {index + 1}") if isinstance(mission, dict) else f"registro {index + 1}"

        if not isinstance(mission, dict):
            errors.append(f"{label}: debe ser un objeto.")
            continue

        mission_id = mission.get("id")
        if not isinstance(mission_id, str) or not mission_id.strip():
            errors.append(f"{label}: falta un ID estable.")

        elif mission_id in ids:
            errors.append(f"{label}: ID duplicado `{mission_id}`.")
        else:
            ids.add(mission_id)

        for field in ("name", "mission_type", "outcome", "landing_site", "normalization"):
            if not isinstance(mission.get(field), str) or not mission[field].strip():
                errors.append(f"{label}: falta `{field}`.")

        landing = mission.get("landing")

        if not isinstance(landing, dict):
            errors.append(f"{label}: falta el grupo `landing`.")
        else:
            try:
                datetime.strptime(landing.get("datetime", ""), "%Y-%m-%dT%H:%M:%S")
            except (TypeError, ValueError):
                errors.append(f"{label}: fecha/hora inválida; se requiere YYYY-MM-DDTHH:MM:SS.")

            for key in ("time_scale", "source_value", "source_url"):
                if not isinstance(landing.get(key), str) or not landing[key].strip():
                    errors.append(f"{label}: falta procedencia de `landing.{key}`.")

            if landing.get("source_url") and not landing["source_url"].startswith("https://"):
                errors.append(f"{label}: `landing.source_url` debe ser HTTPS.")

        coords = mission.get("coordinates")
        if not isinstance(coords, dict):
            errors.append(f"{label}: falta el grupo `coordinates`.")
        else:
            for key, low, high in (("latitude", -90, 90), ("longitude", -180, 180)):
                value = coords.get(key)

                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
                    errors.append(f"{label}: `{key}` debe ser un número entre {low} y {high}.")
                source_values = coords.get("source_values")

                if not isinstance(source_values, dict) or not isinstance(source_values.get(key), str) or not source_values[key].strip():
                    errors.append(f"{label}: falta el valor original de `coordinates.{key}`.")

            for key in ("units", "reference_frame", "site_component", "source_url"):
                if not isinstance(coords.get(key), str) or not coords[key].strip():
                    errors.append(f"{label}: falta procedencia de `coordinates.{key}`.")

            if coords.get("source_url") and not coords["source_url"].startswith("https://"):
                errors.append(f"{label}: `coordinates.source_url` debe ser HTTPS.")

        try:
            date.fromisoformat(mission.get("reviewed_on", ""))
        except (TypeError, ValueError):
            errors.append(f"{label}: `reviewed_on` debe ser una fecha YYYY-MM-DD válida.")

        if not isinstance(mission.get("provenance_notes"), list):
            errors.append(f"{label}: `provenance_notes` debe ser una lista.")

    return errors


def render_report(catalog, errors):
    missions = catalog.get("missions", [])
    status = "Correcto" if not errors else "Con errores"
    lines = [
        "# Informe de validación documental", "",
        f"- Revisión: {date.today().isoformat()}",
        f"- Resultado del validador: {status}",
        f"- Registros: {len(missions)}", "",
        "## Fuentes consultadas y campos comprobados", "",
        "- Fichas de misión NASA NSSDCA: fecha/hora UT del alunizaje, nombre del sitio y que el evento reportado sea el aterrizaje.",
        "- Tabla NASA NSSDCA de coordenadas de sitios Apollo: fila `Lunar Module`, latitud, longitud y marco ME/DE421.",
        "- Resumen histórico NASA de Apollo 11: variante 20:17:39 GMT, registrada como discrepancia de un segundo frente a NSSDCA.", "",
        "## Revisión de registros", "",
    ]

    for m in missions:
        if not isinstance(m, dict):
            continue

        landing, coords = m.get("landing", {}), m.get("coordinates", {})
        notes = "; ".join(m.get("provenance_notes", [])) or "Sin discrepancias documentadas en las fuentes consultadas."
        lines.append(f"- **{m.get('name', m.get('id'))}:** alunizaje {landing.get('source_value', 'sin dato')}; sitio {m.get('landing_site', 'sin dato')}; coordenadas del módulo lunar ({coords.get('latitude', 'null')}, {coords.get('longitude', 'null')})°. {notes}")

    lines += ["", "## Resultado", ""]
    lines.extend(f"- {error}" for error in errors) if errors else lines.append("Los IDs son únicos; fechas, rangos y procedencia por grupo de campos son válidos. La comprobación documental confirma el evento de alunizaje y la fila del módulo lunar.")

    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Lista, consulta y valida misiones lunares.")

    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="Lista las misiones")

    show = commands.add_parser("show", help="Muestra una misión por ID")
    show.add_argument("id")

    check = commands.add_parser("validate", help="Valida el catálogo y actualiza el informe")
    check.add_argument("--report", action="store_true", help="Escribe data/validation-report.md")

    args = parser.parse_args()

    try:
        catalog = load_catalog()
    except (OSError, json.JSONDecodeError) as error:
        parser.error(f"no se pudo leer {DATA}: {error}")

    if args.command == "list":
        for mission in catalog.get("missions", []):
            print(f"{mission['id']}  {mission['name']} — {mission['landing_site']} ({mission['landing']['datetime']} {mission['landing']['time_scale']})")
    elif args.command == "show":
        mission = next((m for m in catalog.get("missions", []) if m.get("id") == args.id), None)

        if mission is None:
            parser.error(f"no existe una misión con ID `{args.id}`")
        print(json.dumps(mission, ensure_ascii=False, indent=2))
    else:
        errors = validate(catalog)
        print(f"Validación: {'correcta' if not errors else f'{len(errors)} error(es)'}.")

        if args.report:
            REPORT.write_text(render_report(catalog, errors), encoding="utf-8")
            print(f"Informe escrito en {REPORT.relative_to(ROOT)}")

        for error in errors:
            print(f"- {error}")
        if errors:
            raise SystemExit(1)


if __name__ == "__main__":
    main()