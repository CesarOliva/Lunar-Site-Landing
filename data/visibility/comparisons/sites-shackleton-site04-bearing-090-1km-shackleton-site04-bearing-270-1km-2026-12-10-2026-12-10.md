# Comparación de sitios

- Escenario A: `shackleton-site04-bearing-090-1km` (Site 04, punto de análisis a 1 km rumbo 090°), 2026-12-10T00:00:00Z a 2026-12-11T00:00:00Z (fin exclusivo).
- Escenario B: `shackleton-site04-bearing-270-1km` (Site 04, punto de análisis a 1 km rumbo 270°), 2026-12-10T00:00:00Z a 2026-12-11T00:00:00Z (fin exclusivo).
- Tiempos en UTC; duración basada en los intervalos muestreados de la etapa 3, recortados al rango solicitado.

| Métrica | A | B | B − A |
|---|---:|---:|---:|
| Horas con Sol visible | 24.0 | 1.166667 | -22.833333 |
| Horas con Tierra visible | 0 | 0 | 0.000000 |
| Mayor ocultamiento continuo del Sol (h) | 0.0 | 22.75 | 22.750000 |
| Mayor ocultamiento continuo de la Tierra (h) | 24.0 | 24.0 | 0.000000 |
| Tiempo indeterminado del Sol (h) | 0 | 0 | 0.000000 |
| Tiempo indeterminado de la Tierra (h) | 0 | 0 | 0.000000 |
| Contactos del Sol | 0 | 0 | 0.000000 |
| Contactos de la Tierra | 0 | 0 | 0.000000 |
| Horas con Sol y Tierra visibles a la vez | 0.0 | 0.0 | 0.000000 |

## Interrupción máxima y límites

- A, sun: sin intervalos ocultos.
- A, earth: 2026-12-10T00:00:00Z a 2026-12-11T00:00:00Z; toca inicio=True, fin=True; precisión de límites 0/0 min.
- B, sun: 2026-12-10T00:00:00Z a 2026-12-10T22:45:00Z; toca inicio=True, fin=False; precisión de límites 5/5 min.
- B, earth: 2026-12-10T00:00:00Z a 2026-12-11T00:00:00Z; toca inicio=True, fin=True; precisión de límites 0/0 min.

## Cobertura y procedencia

- A: -89.76447977799349°, 196.17911063134187° E (MEAN_ME, positivo este, grados); 0 sectores LOLA incompletos en radio 5000 m, resolución [5.0, 5.0] m; DEM `Site04_final_adj_5mpp_surf.tif` ([fuente](https://pgda.gsfc.nasa.gov/products/78)); coordenadas ([fuente](https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf)); resultados [JSON](../sites/shackleton-site04-bearing-090-1km/analysis.json).
  Cobertura temporal: 2026-11-14T00:00:00 a 2027-02-12T00:00:00 UT.
  Huecos de muestreo añadidos como indeterminados: Sol 0.0 h, Tierra 0.0 h.
  Respuestas Horizons guardadas: `14` archivos; documentación https://ssd-api.jpl.nasa.gov/doc/horizons.html.
- B: -89.76447977799349°, 180.08088936865812° E (MEAN_ME, positivo este, grados); 0 sectores LOLA incompletos en radio 5000 m, resolución [5.0, 5.0] m; DEM `Site04_final_adj_5mpp_surf.tif` ([fuente](https://pgda.gsfc.nasa.gov/products/78)); coordenadas ([fuente](https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf)); resultados [JSON](../sites/shackleton-site04-bearing-270-1km/analysis.json).
  Cobertura temporal: 2026-11-14T00:00:00 a 2027-02-12T00:00:00 UT.
  Huecos de muestreo añadidos como indeterminados: Sol 0.0 h, Tierra 0.0 h.
  Respuestas Horizons guardadas: `14` archivos; documentación https://ssd-api.jpl.nasa.gov/doc/horizons.html.

La duración máxima se calcula sobre intervalos ocultos individuales; no se unen a través de tramos indeterminados.
Si el mayor intervalo toca el inicio o fin solicitado, su duración está recortada y el ocultamiento puede continuar fuera del periodo.
La visibilidad corresponde al centro geométrico del objeto, según el cálculo de la etapa 3.
