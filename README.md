# Lunar Landing Site Navigator

Catálogo histórico inicial de tres alunizajes Apollo, con procedencia de los datos en `data/missions.json`.

Requiere Python 3.9 o posterior y no usa dependencias externas.

```powershell
python missions.py list
python missions.py show apollo-11
python missions.py validate --report
```

`validate` comprueba IDs, campos requeridos, fechas, rangos de coordenadas y procedencia documentada. La verificación de contenido frente a las páginas fuente es documental; el comando no descarga ni vuelve a consultar NASA.

## Prueba de visibilidad LOLA + Horizons

Instala las dependencias y descarga el DEM Site04 de NASA/GSFC PGDA antes de ejecutar el cálculo:

```powershell
python -m pip install -r requirements.txt
python visibility.py --download-dem
```

El punto, periodo y parámetros están en `data/visibility-site.json`. La ejecución conserva cada petición y respuesta de Horizons en `data/visibility/horizons/`, y genera `data/visibility/visibility.csv` y `data/visibility/report.md`. La primera consulta usa una hora de paso; los cruces detectados se consultan otra vez con el paso de refinamiento configurado. La geometría es del centro aparente del Sol o la Tierra.
