# Frontend web

La interfaz incluye el comparador de la fase 5 y el MVP histórico 3D de las fases 6 y 7. El comparador contrasta dos sitios en un mismo periodo o un sitio en dos periodos de igual duración; presenta un resumen A/B, cuatro filas de tiempo y el detalle angular de cada intervalo seleccionado.

## Ejecutar

La consulta personalizada necesita el servicio local de Python y el frontend de Vite. Abre dos terminales en la carpeta del proyecto.

```powershell
# Terminal 1: API local (Python estándar, sin paquetes adicionales)
python lunar_api.py
```

```powershell
# Terminal 2: aplicación web
npm install
npm run dev
```

## Datos

Al abrir la página se carga `data/muestras_ejemplo.csv`. Ese archivo contiene datos sintéticos para mostrar la interfaz; no son observaciones lunares. Para cargar otros datos, selecciona un CSV con estas columnas:

```csv
site_id,start_utc,end_utc,sun_azimuth_deg,sun_elevation_deg,horizon_elevation_deg
sitio-a,2025-01-01T00:00:00Z,2025-01-01T00:01:00Z,180,2,4
```

Cada fila define el intervalo `[start_utc, end_utc)`. Las columnas `sun_source` y `horizon_source` son opcionales y se muestran como procedencia en el detalle angular. La elevación del horizonte debe corresponder al azimut solar de la fila, ya calculada por el procesamiento científico.

Los periodos se interpretan como UTC, deben tener inicio anterior al final y las comparaciones entre periodos exigen duraciones iguales. Los huecos y los datos angulares faltantes se reportan como indeterminados. Se aplica el mismo criterio que en consola: elevación del Sol mayor que el horizonte local significa visible; la igualdad significa oculto.

El comparador no consulta Horizons ni calcula perfiles LOLA. No presentes el CSV de demostración como resultado científico.

## Escenas históricas Apollo

La vista inicial muestra el globo 3D y las escenas de Apollo 11, 12 y 14. Seleccionar una misión centra su marcador y actualiza juntos la luz global y la ficha. Arrastra para rotar el globo, usa la rueda o pellizca para cambiar el zoom. Si WebGL no está disponible, la ficha y los ángulos siguen visibles.

Las escenas están en `data/apollo_scenes.json`. Las respuestas JSON originales de cada consulta se conservan en `data/horizons/raw/`. Se pueden regenerar con:

```powershell
python scripts/precompute_apollo_scenes.py
```

El script consulta el servicio público de [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) para obtener las posiciones aparentes del Sol y la Tierra en las horas UT del catálogo. La salida de Horizons usa DE441 y `MEAN_ME (high precision)`; el catálogo registra coordenadas ME/DE421. La interfaz deja visible esta diferencia y no afirma que exista una transformación DE441 a DE421 en este incremento.

El globo usa `public/assets/lroc_color_2k.jpg`, mapa visual de NASA SVS [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), centrado en longitud 0°. La textura tiene resolución global de 2K y sus regiones polares incluyen rellenos de menor resolución. No contiene relieve geométrico y no se usa para calcular visibilidad local. Crédito: NASA Scientific Visualization Studio; color mosaic de LROC/WAC y datos de LRO.

Los ángulos locales se muestran sobre el horizonte geométrico. Como todavía no hay perfiles LOLA locales para los tres sitios Apollo, la visibilidad con relieve queda indeterminada.

## Consultas personalizadas

En **Posición y momento** puedes indicar latitud de −90° a 90°, longitud de −180° a 180° con este positivo, y fecha y hora UTC. El servicio consulta las posiciones aparentes del Sol y la Tierra con JPL Horizons; una consulta válida actualiza el marcador, el centro del globo, la luz solar y la ficha en conjunto. Si Horizons no responde, la escena actual permanece visible y el formulario muestra el error para que puedas reintentar.

El rango admitido comienza el 20 de enero de 1962 y termina 75 días después del momento actual. La escala de Horizons para observaciones posteriores a 1962 es UTC; la [documentación de Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) indica que las predicciones de orientación terrestre cubren aproximadamente 78 días hacia delante. Las coordenadas personalizadas se interpretan en ME y no se transforma el marco reportado por Horizons. La caché local persiste en `.cache/horizons.sqlite3` y usa posición, instante, fecha de datos y versión de esquema como clave.

El servicio no calcula ni consulta perfiles LOLA, así que la visibilidad local respecto al relieve permanece indeterminada para cualquier punto personalizado. Los ángulos de Sol y Tierra y su posición sobre el horizonte geométrico sí se muestran.
