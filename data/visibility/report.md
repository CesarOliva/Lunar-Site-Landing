# Informe de visibilidad lunar

- Sitio: Centro documentado de Site 04, borde de Shackleton (ID `shackleton-site04-center`)
- Punto: -89.7668° latitud, 188.13° este
- Altura del observador: 1.0 m sobre el DEM; elevación local 767.979 m
- DEM: `Site04_final_adj_5mpp_surf.tif`, LDEM polar LOLA de 5 m/píxel, Site04; versión publicada en NASA/GSFC PGDA
- Proyección: South polar stereographic, coordenadas X/Y en metros; marco MOON_ME, efeméride DE421 (según NASA/GSFC PGDA)
- Referencia vertical: El producto define Z como altura superficial en metros; el GeoTIFF no declara otro datum vertical explícito. Para Horizons se asume Z relativo al radio medio lunar de 1.737.400 m.
- Resolución efectiva de raster: (5.0, 5.0) m/píxel; tamaño 3200 × 3200 píxeles
- Cobertura del raster (X/Y): (-9000.0, -15000.0, 7000.0, 1000.0) m
- Periodo UT: 2026-11-14T00:00:00 a 2027-02-12T00:00:00
- Horizonte de terreno: radio 5000 m, paso radial 5 m, azimut 1°
- Sectores sin cobertura completa dentro del radio: 0 de 360
- Parámetros y respuestas originales de Horizons: `data/visibility/horizons/`

- Coordenadas del sitio: https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf
- Modelo LOLA: https://pgda.gsfc.nasa.gov/products/78
- Efemérides y marco observador: https://ssd-api.jpl.nasa.gov/doc/horizons.html

## Ventanas visibles muestreadas

### Sun
- 2026-11-14T00:00:00 a 2026-11-23T11:35:00 UT
- 2026-12-10T13:50:00 a 2026-12-23T01:00:00 UT
- 2027-01-09T06:40:00 a 2027-01-21T13:20:00 UT
- 2027-02-08T00:05:00 a 2027-02-12T00:00:00 UT

### Earth
- No se encontraron muestras visibles en el periodo.

Los límites son muestras discretas; las ventanas de una hora se refinan a cinco minutos cerca de cruces detectados.
Estado indeterminado indica que el DEM no tiene cobertura válida en el azimut correspondiente.
El producto LOLA de 5 m contiene aproximadamente 90 % de píxeles interpolados según NASA/GSFC; este cálculo no propaga la incertidumbre de elevación.
La referencia vertical del GeoTIFF no se explicita por separado; se asumió que Z se mide desde el radio lunar medio al ubicar el observador en Horizons.
