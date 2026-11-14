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

## Etapa 3: tres puntos del polo sur

```powershell
python analyze_lunar_sites.py
```

`data/visibility-sites.json` registra el punto Site04 documentado y dos puntos derivados a 1 km en rumbos locales 090° y 270°. Son sitios de análisis, no ubicaciones oficiales de aterrizaje. Los tres reutilizan la configuración común de `data/visibility-site.json`, el mismo DEM, periodo, altura y pasos.

El comando guarda un `analysis.json`, un CSV y las respuestas originales de Horizons por sitio en `data/visibility/sites/<id>/`; también produce `all-sites.csv`, `report.md` y `comparison-example.json` con un contraste solar respaldado por las muestras y perfiles de horizonte.

## Etapa 4: comparaciones

Los rangos usan UTC, con inicio inclusivo y fin exclusivo. El comparador rechaza fechas fuera de la cobertura disponible y, en modo fechas, periodos con distinta duración.

```powershell
python compare_visibility.py sites shackleton-site04-bearing-090-1km shackleton-site04-bearing-270-1km --start 2026-12-10 --end 2026-12-11
python compare_visibility.py dates shackleton-site04-center --start-a 2026-11-23 --end-a 2026-11-24 --start-b 2026-12-10 --end-b 2026-12-11
```

Cada ejecución escribe un resumen Markdown y un JSON lado a lado en `data/visibility/comparisons/`. Los totales usan los intervalos de la etapa 3 recortados al periodo pedido; huecos de muestreo se cuentan como indeterminados. Las interrupciones ocultas no se unen a través de esos tramos. El JSON incluye cobertura, fuentes, límites tocados y diferencias B − A.

Ejemplos reales reproducibles: `sites-shackleton-site04-bearing-090-1km-shackleton-site04-bearing-270-1km-2026-12-10-2026-12-10` y `dates-shackleton-site04-center-2026-11-23-2026-12-10`.
