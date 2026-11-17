# Landing-Site-Simulator

Interfaz de misiones Apollo con evaluaciones preliminares de sus sitios históricos y consultas de fecha o coordenadas para otros escenarios.

## Iniciar la aplicación

Se requieren Python 3.10 o posterior y Node.js.

1. En una terminal, inicia el servicio lunar:

   ```powershell
   python lunar_api.py
   ```

2. En otra terminal, inicia el frontend:

   ```powershell
   npm install
   npm run dev
   ```

Vite reenvía las solicitudes `/api` al servicio local en `127.0.0.1:8000`. Las evaluaciones históricas ya están guardadas en `data/apollo_scenes.json`; el backend consulta NASA/JPL Horizons y el terreno LOLA al pedir nuevas fechas o ubicaciones. La descarga de datos LOLA de un área puede requerir conexión a internet la primera vez; los archivos se guardan en `.cache/lola`.

En la planificación, Site 04 usa sus muestras precalculadas. Para coordenadas propias, el paso **Luz y comunicación** consulta `/api/visibility-day` para el día elegido y la fecha de comparación, con muestras horarias de Horizons y el perfil LOLA local. La primera consulta necesita conexión a internet. Si LOLA no cubre el punto, se muestran los ángulos sobre el horizonte geométrico y se marca la visibilidad respecto al relieve como indeterminada. Horizons limita estas consultas a su cobertura histórica y hasta 75 días hacia el futuro.


## Consola

Listar las misiones Apollo:

```powershell
python lunar_navigator.py catalog list
```

Comparar dos sitios con la muestra incluida:

```powershell
python lunar_navigator.py compare-sites --csv data/muestras_ejemplo.csv --site-a polar-a --site-b polar-b --start 2025-01-01T00:00:00Z --end 2025-01-01T00:02:00Z
```

Para comparar dos periodos del mismo sitio, usa `compare-periods` con `--site`, `--start-a`, `--end-a`, `--start-b` y `--end-b`.

Las evaluaciones son un cribado preliminar. La resolución de LOLA no modela rocas, cráteres pequeños, estabilidad de las patas ni condiciones durante toda la ventana de descenso.

## Luna de alta calidad y primera persona (proyecto MOON)

La carpeta `moon/` contiene el proyecto MOON completo (ver `moon/README.md`). La luna principal de la aplicación se
construye con 256 teselas de NASA Trek. Al seleccionar un punto en el mapa aparece la tarjeta *Explorador lunar*, que abre
directamente la vista de primera persona (Cesium, imagen WMTS y relieve LOLA de 16 bits) en esas mismas coordenadas.
Estas funciones usan un proxy `/pds` (ya configurado en `vite.config.js`) y no requieren `lunar_api.py`.
