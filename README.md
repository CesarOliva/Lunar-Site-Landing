# Lunar Landing Site Navigator

Aplicación interactiva para explorar las misiones Apollo y evaluar de forma preliminar posibles sitios de aterrizaje lunar. Combina una interfaz 3D, un explorador de superficie en primera persona y herramientas de análisis con datos de NASA/JPL.

## Funciones

- Explora la Luna y consulta las misiones Apollo con sus ubicaciones históricas.
- Revisa cronologías y detalles de las misiones.
- Evalúa sitios y condiciones de iluminación para coordenadas y fechas seleccionadas.
- Consulta visibilidad del Sol y la Tierra sobre el horizonte local cuando hay datos de terreno disponibles.
- Abre una vista de superficie en primera persona con imagen y relieve lunar.
- Usa la aplicación MOON independiente en `/moon/` para explorar el globo, teselas de detalle y sitios NAC.
- Compara sitios o periodos desde la consola y exporta planes de misión en PDF desde la interfaz.

## Requisitos

- Node.js y npm.
- Python 3.10 o posterior.
- Conexión a internet para consultas nuevas de NASA/JPL Horizons, mapas y datos de terreno. Las escenas históricas incluidas se pueden consultar sin volver a calcularlas.

## Inicio local

Desde la raíz del proyecto, instala las dependencias de JavaScript:

```powershell
npm install
```

Inicia el servicio de análisis lunar en una terminal:

```powershell
python lunar_api.py
```

En otra terminal, inicia Vite:

```powershell
npm run dev
```

Abre la dirección local que muestra Vite (por defecto, `http://localhost:5173`). El proxy de desarrollo envía `/api` a `http://127.0.0.1:8000` y `/pds` al servicio de datos planetarios de la NASA.

El explorador MOON independiente está disponible en `http://localhost:5173/moon/`.

## Compilación

```powershell
npm run build
npm run preview
```

La compilación genera las páginas de Oddity y MOON. Para publicar en otro servidor, configura un proxy equivalente para `/pds` hacia `https://pds-geosciences.wustl.edu` y conserva la cabecera `Range`, necesaria para leer los datos LOLA. Cesium se publica bajo `/cesium`.

## Herramientas de consola

Lista el catálogo histórico:

```powershell
python lunar_navigator.py catalog list
```

Consulta una misión:

```powershell
python lunar_navigator.py catalog show apollo-11
```

Compara dos sitios con los datos de ejemplo:

```powershell
python lunar_navigator.py compare-sites --csv data/muestras_ejemplo.csv --site-a polar-a --site-b polar-b --start 2025-01-01T00:00:00Z --end 2025-01-01T00:02:00Z
```

Para comparar dos periodos en el mismo sitio, usa `compare-periods` con `--site`, `--start-a`, `--end-a`, `--start-b` y `--end-b`. Las fechas deben incluir zona UTC en formato ISO 8601.

## Datos y caché

- `data/apollo_scenes.json`: evaluaciones precalculadas de sitios Apollo.
- `data/apollo_sites.json` y `data/missions.json`: catálogos de sitios y misiones.
- `.cache/lola`: parches locales de elevación LOLA, descargados cuando se necesitan.
- `.cache/horizons.sqlite3`: caché local de consultas de Horizons.

Las consultas nuevas de Horizons están limitadas a su cobertura histórica y hasta 75 días en el futuro. Si LOLA no cubre una ubicación, la aplicación puede mostrar ángulos respecto al horizonte geométrico y marcar como indeterminada la visibilidad respecto al relieve.

## Estructura principal

```text
src/                    Interfaz React de Oddity
moon/                   Explorador lunar MOON independiente
lunar_api.py            API local para escenas y visibilidad
lunar_navigator.py      Herramientas de consola
lunar_terrain.py        Lectura y evaluación del terreno LOLA
scripts/                Preparación de datos y utilidades
data/                   Catálogos, muestras y escenas precalculadas
```

Consulta [moon/README.md](moon/README.md) para detalles sobre el explorador MOON.

## Alcance

Las evaluaciones son un cribado preliminar, no una certificación de seguridad para aterrizaje. La resolución del modelo LOLA no representa rocas, cráteres pequeños, estabilidad de las patas ni todas las condiciones de una ventana de descenso.
