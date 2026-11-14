# Etapa 3: comparación de tres puntos del polo sur lunar

- Periodo común UT: 2026-11-14T00:00:00 a 2027-02-12T00:00:00
- Paso inicial: 60 min; refinamiento: 5 min
- Altura de observador: 1.0 m sobre el terreno
- Modelo: LDEM polar LOLA de 5 m/píxel, Site04; versión publicada en NASA/GSFC PGDA; radio de terreno: 5000 m
- Los dos puntos adicionales se derivan geodésicamente del centro Site04 publicado; no son sitios oficiales de aterrizaje.

## Centro documentado de Site 04, borde de Shackleton (`shackleton-site04-center`)
- Coordenadas: -89.7668, 188.13° E (MEAN_ME, positivo este, grados)
- Origen de coordenadas: Punto de análisis documentado para Site04 (Shackleton Rim); la fuente publica longitud -171.87°, normalizada a 188.13° este. — https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf
- Elevación local LOLA: 767.979 m; píxel [5.0, 5.0] m; sectores incompletos 0/360
- Terreno: https://pgda.gsfc.nasa.gov/products/78; Horizons: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Muestras: 4718; configuración, perfil, muestras e intervalos: `data/visibility/sites/shackleton-site04-center/analysis.json`
- Respuestas originales Horizons: `data/visibility/sites/shackleton-site04-center/horizons/`

- Sun: oculto 1346, visible 1013
  - Ventana visible muestreada: 2026-11-14T00:00:00Z a 2026-11-23T11:35:00Z UT
  - Ventana visible muestreada: 2026-12-10T13:50:00Z a 2026-12-23T01:00:00Z UT
  - Ventana visible muestreada: 2027-01-09T06:40:00Z a 2027-01-21T13:20:00Z UT
  - Ventana visible muestreada: 2027-02-08T00:05:00Z a 2027-02-12T00:00:00Z UT
- Earth: oculto 2359

## Site 04, punto de análisis a 1 km rumbo 270° (`shackleton-site04-bearing-270-1km`)
- Coordenadas: -89.76447977799349, 180.08088936865812° E (MEAN_ME, positivo este, grados)
- Origen de coordenadas: Coordenada derivada desde el centro publicado de Site04 con geodésica esférica de radio 1.737.400 m; offset local de 1.000 m en rumbo 270° (oeste desde el norte local). Punto de análisis, no ubicación oficial de aterrizaje. — https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf
- Elevación local LOLA: 129.440 m; píxel [5.0, 5.0] m; sectores incompletos 0/360
- Terreno: https://pgda.gsfc.nasa.gov/products/78; Horizons: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Muestras: 4718; configuración, perfil, muestras e intervalos: `data/visibility/sites/shackleton-site04-bearing-270-1km/analysis.json`
- Respuestas originales Horizons: `data/visibility/sites/shackleton-site04-bearing-270-1km/horizons/`

- Sun: oculto 1389, visible 970
  - Ventana visible muestreada: 2026-11-14T00:00:00Z a 2026-11-23T10:05:00Z UT
  - Ventana visible muestreada: 2026-12-10T22:50:00Z a 2026-12-22T23:25:00Z UT
  - Ventana visible muestreada: 2027-01-09T15:35:00Z a 2027-01-21T11:55:00Z UT
  - Ventana visible muestreada: 2027-02-08T23:25:00Z a 2027-02-12T00:00:00Z UT
- Earth: oculto 2359

## Site 04, punto de análisis a 1 km rumbo 090° (`shackleton-site04-bearing-090-1km`)
- Coordenadas: -89.76447977799349, 196.17911063134187° E (MEAN_ME, positivo este, grados)
- Origen de coordenadas: Coordenada derivada desde el centro publicado de Site04 con geodésica esférica de radio 1.737.400 m; offset local de 1.000 m en rumbo 090° (este desde el norte local). Punto de análisis, no ubicación oficial de aterrizaje. — https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf
- Elevación local LOLA: 1376.793 m; píxel [5.0, 5.0] m; sectores incompletos 0/360
- Terreno: https://pgda.gsfc.nasa.gov/products/78; Horizons: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Muestras: 4718; configuración, perfil, muestras e intervalos: `data/visibility/sites/shackleton-site04-bearing-090-1km/analysis.json`
- Respuestas originales Horizons: `data/visibility/sites/shackleton-site04-bearing-090-1km/horizons/`

- Sun: oculto 1299, visible 1060
  - Ventana visible muestreada: 2026-11-14T00:00:00Z a 2026-11-23T13:55:00Z UT
  - Ventana visible muestreada: 2026-12-09T22:30:00Z a 2026-12-23T02:05:00Z UT
  - Ventana visible muestreada: 2027-01-08T18:00:00Z a 2027-01-21T14:30:00Z UT
  - Ventana visible muestreada: 2027-02-07T13:20:00Z a 2027-02-12T00:00:00Z UT
- Earth: oculto 2359

## Caso de contraste

En 2026-12-10T14:00:00Z, el centro del Sol resulta visible desde `shackleton-site04-bearing-090-1km` y oculto desde `shackleton-site04-bearing-270-1km`.
- Visible: azimut 327.136277°, elevación 1.622150°, horizonte -0.996523°, diferencia 2.618673°.
- Oculto: azimut 343.236075°, elevación 1.649830°, horizonte 4.219791°, diferencia -2.569961°.
- Datos trazables en `comparison-example.json`, los JSON por sitio y las respuestas Horizons guardadas.

## Límites del modelo

El producto LOLA de 5 m tiene aproximadamente 90 % de píxeles interpolados según NASA/GSFC; estas salidas no propagan la incertidumbre vertical.
El GeoTIFF no declara un datum vertical por separado; para la altura del observador se asume Z respecto al radio medio lunar de 1.737.400 m.
CSV con todas las muestras: `data\visibility\sites\all-sites.csv`
