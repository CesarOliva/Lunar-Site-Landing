# MOON · explorador lunar con datos de NASA

Proyecto MOON completo, integrado dentro de Lunar-Site-Landing. Se puede usar de tres formas:

| Dónde | Qué es |
|---|---|
| **Luna principal de Oddity** | `src/componentes/Luna/Moon.jsx` muestra la luna de **256 teselas** de NASA Trek (calidad "Alta" de MOON: 128 de imagen LRO WAC + 128 de relieve LOLA) en lugar del modelo GLB. El GLB queda solo como respaldo mientras se descargan las teselas. |
| **Primera persona al seleccionar un punto** | Al seleccionar un punto del mapa aparece la tarjeta *Explorador lunar* (`src/componentes/superficie/SurfaceInvite.jsx`) y, desde ella o desde el botón del panel de la misión, se entra **directamente** en primera persona (`SurfaceScreen.jsx`, con el diseño de Oddity). Usa las coordenadas del punto tal cual: las históricas de la misión o las que el usuario haya editado en la evaluación del sitio; nunca se redondean ni se inventan valores. |
| **Explorador MOON independiente** | Página aparte `/moon/` (globo con 5 niveles de calidad, selección de puntos, sitios NAC y primera persona), con sus estilos aislados. No está enlazada desde Oddity; se abre en `http://localhost:5173/moon/`. |

## Estructura

```
moon/
  index.html                 página independiente del explorador (/moon/)
  src/
    App.jsx, App.css         explorador MOON (globo + panel)
    MoonScene.jsx            globo Three.js (OrbitControls, teselas de detalle bajo demanda)
    globe.js                 capas WMTS, geometría con relieve y conversión lat/lon <-> dirección
    moonTiles.js             catálogo, capacidades y descarga de teselas WMTS de NASA Trek (con caché de sesión)
    lolaDem.js               elevación LOLA de 16 bits del PDS (peticiones multirango + caché de ventanas)
    integracion/             luna de 256 teselas para react-three-fiber (HighQualityMoon) y precarga
    surface/                 vista de primera persona (Cesium)
      useSurfaceExplorer.jsx hook con TODA la lógica de la primera persona (estado, acciones, visor); sin interfaz
      SurfaceExplorer.jsx    interfaz propia de MOON sobre ese hook (CSS prefijado "moon-sx")
      cesium-host.css        contenedor del visor de Cesium
      MoonSurface.jsx        visor CesiumJS: elipsoide lunar, capas de imagen, terreno LOLA, detalle calibrado
      imageryStack.js, detailImagery.js, lolaTerrain.js, microRelief.js, firstPerson.js, prefetch.js, lru.js
```

## Requisitos de ejecución

- `npm install` en la raíz de Lunar-Site-Landing (añade `cesium` y `vite-plugin-static-copy`).
- **Proxy `/pds`**: el servidor del PDS de la NASA (elevación LOLA de 16 bits) no envía cabeceras CORS, así que se accede
  por un proxy del mismo origen. `vite.config.js` ya lo define para `npm run dev` y `npm run preview`; en un despliegue
  real hace falta uno equivalente de `/pds` hacia `https://pds-geosciences.wustl.edu` (debe reenviar la cabecera `Range`).
- Cesium se sirve como archivos estáticos desde `/cesium` (los copia `vite-plugin-static-copy`).
- `npm run build` genera las dos páginas (`index.html` y `moon/index.html`).

## Convención de coordenadas

`globe.js` fija la orientación de la esfera: longitud 0° hacia +Z y el este a la derecha, igual que los marcadores
de misión (`x = cos(lat)·sin(lon)`, `z = cos(lat)·cos(lon)`). Latitud y longitud siempre son lunares, con el este positivo.

## Notas

- Las teselas de la luna de 256 teselas se descargan una sola vez por sesión (se empiezan a pedir durante la introducción).
- El detalle por debajo de ~10–30 m de la primera persona es sintético y calibrado con la rugosidad real de LOLA;
  hay un deslizador para apagarlo.
- `moon/src/surface/microRelief.test.mjs` valida la calibración del microrrelieve: `node moon/src/surface/microRelief.test.mjs`.
