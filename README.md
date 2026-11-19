# Lunar Landing Site Navigator

Interactive application for exploring Apollo missions and performing preliminary evaluations of potential lunar landing sites. It combines a 3D interface, a first-person surface explorer, and analysis tools powered by NASA/JPL data.

## Features

- Explore the Moon and view Apollo missions with their historical locations.
- Review mission timelines and details.
- Evaluate sites and lighting conditions for selected coordinates and dates.
- Check the visibility of the Sun and Earth above the local horizon when terrain data is available.
- Open a first-person surface view with lunar imagery and elevation data.
- Use the standalone MOON application at `/moon/` to explore the globe, detail tiles, and NAC sites.
- Compare sites or time periods from the command line and export mission plans as PDFs from the interface.

## Requirements

- Node.js and npm.
- Python 3.10 or later.
- An internet connection for new NASA/JPL Horizons queries, maps, and terrain data. Included historical scenes can be viewed without recalculating them.

## Local setup

From the project root, install the JavaScript dependencies:

```powershell
npm install
```

Start the lunar analysis service in one terminal:

```powershell
python lunar_api.py
```

In another terminal, start Vite:

```powershell
npm run dev
```

Open the local address displayed by Vite (by default, `http://localhost:5173`). The development proxy forwards `/api` to `http://127.0.0.1:8000` and `/pds` to NASA's planetary data service.

The standalone MOON explorer is available at `http://localhost:5173/moon/`.

## Build

```powershell
npm run build
npm run preview
```

The build generates the Oddity and MOON pages. To deploy to another server, configure an equivalent proxy for `/pds` to `https://pds-geosciences.wustl.edu` and preserve the `Range` header, which is required to read LOLA data. Cesium is served under `/cesium`.

## Command-line tools

List the historical catalog:

```powershell
python lunar_navigator.py catalog list
```

View a mission:

```powershell
python lunar_navigator.py catalog show apollo-11
```

Compare two sites using the sample data:

```powershell
python lunar_navigator.py compare-sites --csv data/muestras_ejemplo.csv --site-a polar-a --site-b polar-b --start 2025-01-01T00:00:00Z --end 2025-01-01T00:02:00Z
```

To compare two periods at the same site, use `compare-periods` with `--site`, `--start-a`, `--end-a`, `--start-b`, and `--end-b`. Dates must include the UTC time zone in ISO 8601 format.

## Data and cache

- `data/apollo_scenes.json`: precomputed evaluations of Apollo sites.
- `data/apollo_sites.json` and `data/missions.json`: site and mission catalogs.
- `.cache/lola`: local LOLA elevation patches, downloaded as needed.
- `.cache/horizons.sqlite3`: local cache of Horizons queries.

New Horizons queries are limited to its historical coverage and up to 75 days into the future. If LOLA does not cover a location, the application may show angles relative to the geometric horizon and mark terrain-based visibility as indeterminate.

## Main structure

```text
src/                    Oddity React interface
moon/                   Standalone MOON lunar explorer
lunar_api.py            Local API for scenes and visibility
lunar_navigator.py      Command-line tools
lunar_terrain.py        LOLA terrain reading and evaluation
scripts/                Data preparation and utilities
data/                   Catalogs, samples, and precomputed scenes
```

See [moon/README.md](moon/README.md) for details about the MOON explorer.

## Scope

The evaluations are for preliminary screening, not landing safety certification. The resolution of the LOLA model does not represent rocks, small craters, landing-leg stability, or all conditions during a descent window.