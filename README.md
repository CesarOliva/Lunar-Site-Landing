# Lunar Landing Site Navigator

Consulta [FRONTEND.md](FRONTEND.md) para ejecutar el frontend web y ver las fuentes y limitaciones de las escenas históricas.

El proyecto contiene la herramienta de consola, el comparador web, las escenas históricas 3D de Apollo 11, 12, 14, 15, 16 y 17 y consultas web para coordenadas y fechas elegidas. Para usar consultas personalizadas inicia `python lunar_api.py` y `npm run dev` en dos terminales, según [FRONTEND.md](FRONTEND.md). La API y la consola usan Python 3.10 o posterior y la API no instala paquetes adicionales.

## Catálogo

```powershell
python lunar_navigator.py catalog list
python lunar_navigator.py catalog show apollo-11
```

El catálogo está en `data/apollo_sites.json`. Conserva las horas NSSDCA como UT, el marco de coordenadas y las fuentes. Apollo 11 también registra la alternativa de un segundo que aparece en la cronología histórica de NASA. El catálogo no convierte escalas temporales.

## Comparaciones

El comparador consume muestras ya preparadas por el procesamiento científico. Cada fila representa el intervalo semiabierto `[start_utc, end_utc)` y contiene:

```csv
site_id,start_utc,end_utc,sun_azimuth_deg,sun_elevation_deg,horizon_elevation_deg
polar-a,2025-01-01T00:00:00Z,2025-01-01T00:01:00Z,180,2,4
polar-a,2025-01-01T00:01:00Z,2025-01-01T00:02:00Z,181,5,4
polar-b,2025-01-01T00:00:00Z,2025-01-01T00:01:00Z,180,6,4
polar-a,2025-01-02T00:00:00Z,2025-01-02T00:01:00Z,185,5,4
```

Puedes ejecutar los ejemplos directamente con [`data/muestras_ejemplo.csv`](data/muestras_ejemplo.csv). Sus números son sintéticos y solo ilustran el formato; no son observaciones científicas. La elevación del horizonte debe ser la del azimut solar de la muestra, calculada con un perfil local válido. Si falta la elevación solar o el horizonte, el estado es indeterminado. La igualdad entre elevación solar y horizonte se clasifica como oculta. El azimut se valida y se preserva para rastrear la muestra, pero la clasificación requiere que el horizonte ya esté evaluado en ese azimut.

```powershell
python lunar_navigator.py compare-sites --csv data/muestras_ejemplo.csv --site-a polar-a --site-b polar-b --start 2025-01-01T00:00:30Z --end 2025-01-01T00:02:00Z

python lunar_navigator.py compare-periods --csv data/muestras_ejemplo.csv --site polar-a `
  --start-a 2025-01-01T00:00:00Z --end-a 2025-01-01T00:02:00Z `
  --start-b 2025-01-02T00:00:00Z --end-b 2025-01-02T00:02:00Z
```

Los reportes son JSON en stdout. Incluyen horas visibles, ocultas e indeterminadas, intervalos recortados al rango y coincidencia de visibilidad. `interrupciones` cuenta cada tramo oculto dentro del periodo recortado. Un hueco entre filas se conserva como indeterminado; no se interpola ni se extrapola. Para comparar periodos, la coincidencia mide cuándo ambos periodos estaban visibles al mismo tiempo transcurrido desde sus respectivos inicios.

El CSV debe incluir muestras de cobertura para los sitios y rangos consultados. Este programa no descarga efemérides Horizons ni modelos LOLA, ni calcula perfiles de horizonte: esos insumos y su procedencia deben ser preparados por el procesamiento científico antes de comparar. Cada fila corresponde a un intervalo, así que la resolución temporal queda expresada por sus límites.

## Procedencia de las fichas

- Coordenadas de alunizaje: [NSSDCA Lunar Sites](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html)
- Hora de Apollo 11: [NSSDCA Apollo 11](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html)
- Hora de Apollo 12: [NSSDCA Apollo 12](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo12info.html)
- Hora de Apollo 14: [NSSDCA Apollo 14](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo14info.html)
- Diferencia de un segundo en Apollo 11: [NASA Apollo 11 chronology](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm)
