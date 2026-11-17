import {
  Ellipsoid,
  GeographicTilingScheme,
  Rectangle,
  UrlTemplateImageryProvider,
} from 'cesium'
import { LruCache } from './lru.js'

const GLOBAL_LONGITUDE_SPAN = 300
const BASE_CANDIDATE_MAX_METERS = 25

// Caché de sesión de teselas de imagen ya descargadas y decodificadas, compartida entre capas,
// reconstrucciones (deslizador de detalle, cambio de imagen base) y entradas repetidas a superficie.
// ~320 teselas de 256x256 RGBA ≈ 80 MB.
export const imageTileCache = new LruCache(320)

/**
 * Hace que `provider.requestImage` use `imageTileCache`. Se comparten también las peticiones en
 * curso; los fallos transitorios no se guardan, pero un 404 (zona sin cobertura) sí, para no
 * volver a pedir lo que se sabe que no existe.
 */
export function withTileCache(provider, layerId) {
  const original = provider.requestImage.bind(provider)
  provider.requestImage = (x, y, level, request) => {
    const key = `${layerId}/${level}/${x}/${y}`
    const hit = imageTileCache.get(key)
    if (hit) return hit
    const pending = original(x, y, level, request)
    if (!pending) return pending // Cesium limitó la petición: reintentará
    const stored = Promise.resolve(pending)
    imageTileCache.set(key, stored)
    stored.then(
      (image) => { if (!image) imageTileCache.delete(key) },
      (error) => { if (error?.statusCode !== 404) imageTileCache.delete(key) },
    )
    return stored
  }
  return provider
}

export function createUrlProvider(layer) {
  const provider = new UrlTemplateImageryProvider({
    url: layer.template
      .replaceAll('{Style}', layer.style)
      .replaceAll('{TileMatrixSet}', layer.matrixSetId)
      .replaceAll('{TileMatrix}', '{z}')
      .replaceAll('{TileRow}', '{y}')
      .replaceAll('{TileCol}', '{x}'),
    tilingScheme: new GeographicTilingScheme({
      ellipsoid: Ellipsoid.MOON,
      numberOfLevelZeroTilesX: layer.levelZeroTilesX,
      numberOfLevelZeroTilesY: layer.levelZeroTilesY,
    }),
    rectangle: Rectangle.fromDegrees(
      layer.bounds.west, layer.bounds.south, layer.bounds.east, layer.bounds.north,
    ),
    tileWidth: layer.tileWidth,
    tileHeight: layer.tileHeight,
    minimumLevel: 0,
    maximumLevel: layer.maximumLevel,
    credit: 'NASA Trek',
  })
  // Una tesela inexistente (404) solo significa "sin cobertura": no reintentar.
  provider.errorEvent.addEventListener((error) => { error.retry = false })
  return withTileCache(provider, layer.id)
}

/**
 * Reduce las ~10 capas globales superpuestas de Trek a las necesarias: un fondo de respaldo,
 * la imagen global fina elegida (la de menor m/píxel servida salvo que se pida otra) y los
 * mosaicos regionales (p. ej. NAC) que sean más finos. Orden: de abajo hacia arriba.
 */
export function buildLayerStack(layers, baseId) {
  const isGlobal = (layer) => layer.bounds.east - layer.bounds.west >= GLOBAL_LONGITUDE_SPAN
  const globals = layers.filter(isGlobal)
  const candidates = globals.filter((layer) => layer.resolutionMetersPerPixel < BASE_CANDIDATE_MAX_METERS)
  const base = candidates.find((layer) => layer.id === baseId) ?? candidates.at(-1) ?? globals.at(-1)
  const fallback = globals.find((layer) => /WAC_Mosaic_Global_303ppd_v02/.test(layer.id)) ?? globals[0]
  const regionals = layers.filter((layer) => (
    !isGlobal(layer) && base && layer.resolutionMetersPerPixel < base.resolutionMetersPerPixel
  ))
  const stack = [...new Set([fallback, base, ...regionals].filter(Boolean))]
  return { stack, base, candidates }
}
