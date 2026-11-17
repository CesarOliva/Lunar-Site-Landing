import { Cartographic } from 'cesium'
import { findImageryLayersForPoint } from '../moonTiles.js'
import { loadLolaWindowCached } from '../lolaDem.js'
import { buildLayerStack, createUrlProvider } from './imageryStack.js'
import { LOLA_WINDOW_RADIUS_KM } from './config.js'

const WARM_LEVELS_BELOW_MAX = 4 // niveles max-4..max alrededor del punto
const WARM_CONCURRENCY = 6

/**
 * Precarga lo que la vista de superficie necesitará para un punto, mientras el usuario todavía
 * está en el globo: capas de imagen (catálogo + capacidades), ventana LOLA y las teselas de imagen
 * alrededor del punto en los niveles más finos. Todo queda en las cachés de sesión, así que al
 * pulsar "Explorar" la carga es casi instantánea. Devuelve una función para cancelar.
 */
export function prefetchSurface(point) {
  let cancelled = false

  const run = async () => {
    const [layers] = await Promise.all([
      findImageryLayersForPoint(point.latitude, point.longitude),
      loadLolaWindowCached(point.latitude, point.longitude, LOLA_WINDOW_RADIUS_KM),
    ])
    if (cancelled) return

    const { stack } = buildLayerStack(layers)
    const position = Cartographic.fromDegrees(point.longitude, point.latitude)
    const jobs = []
    for (const layer of stack) {
      const provider = createUrlProvider(layer)
      for (let level = layer.maximumLevel; level >= Math.max(0, layer.maximumLevel - WARM_LEVELS_BELOW_MAX); level -= 1) {
        const center = provider.tilingScheme.positionToTileXY(position, level)
        if (!center) continue
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) jobs.push({ provider, x: center.x + dx, y: center.y + dy, level })
        }
      }
    }

    let next = 0
    const workers = Array.from({ length: WARM_CONCURRENCY }, async () => {
      while (!cancelled && next < jobs.length) {
        const { provider, x, y, level } = jobs[next]
        next += 1
        try { await provider.requestImage(x, y, level) } catch { /* sin cobertura: se ignora */ }
      }
    })
    await Promise.all(workers)
  }

  run().catch(() => { /* la precarga es oportunista: los errores los verá la carga real */ })
  return () => { cancelled = true }
}
