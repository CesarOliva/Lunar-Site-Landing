import * as THREE from 'three'
import { loadWmtsTiles } from '../moonTiles.js'
import {
  GLOBE_RADIUS,
  GLOBE_ROTATION,
  createTerrainGeometry,
  elevationLayer,
  imageryLayer,
} from '../globe.js'

/** Nivel de calidad "Alta" del explorador MOON: 256 teselas WMTS (128 de imagen + 128 de relieve). */
export const HIGH_QUALITY_LEVEL = 3

let cachedMoon = null
let cachedProgress = { imagery: { loaded: 0, total: 0 }, elevation: { loaded: 0, total: 0 } }
const progressListeners = new Set()

/**
 * Descarga las 256 teselas de NASA Trek (imagen LRO WAC + elevación LOLA) y construye la luna con
 * relieve, igual que el globo del explorador MOON. La carga se hace una sola vez por sesión: las
 * siguientes llamadas devuelven la misma promesa (y el mismo objeto 3D, que se vuelve a montar
 * donde haga falta). La orientación es la de la aplicación: longitud 0° hacia +Z, este a la derecha.
 *
 * @param {number} radius radio con el que se mostrará (la esfera original mide GLOBE_RADIUS).
 */
export function loadHighQualityMoon({ radius = 1.1 } = {}) {
  cachedMoon ??= (async () => {
    const controller = new AbortController()
    const report = (layer) => (value) => {
      cachedProgress = { ...cachedProgress, [layer]: value }
      progressListeners.forEach((listener) => listener(cachedProgress))
    }
    const [imagery, elevation] = await Promise.all([
      loadWmtsTiles(imageryLayer, HIGH_QUALITY_LEVEL, controller.signal, report('imagery')),
      loadWmtsTiles(elevationLayer, HIGH_QUALITY_LEVEL, controller.signal, report('elevation')),
    ])

    const texture = new THREE.CanvasTexture(imagery.canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    const geometry = createTerrainGeometry(elevation, HIGH_QUALITY_LEVEL)
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.y = GLOBE_ROTATION

    const group = new THREE.Group()
    group.name = 'moon-high-quality'
    group.scale.setScalar(radius / GLOBE_RADIUS)
    group.add(mesh)

    return {
      object: group,
      failedTiles: imagery.failed + elevation.failed,
      totalTiles: imagery.total + elevation.total,
    }
  })().catch((error) => {
    cachedMoon = null // un fallo no debe quedar cacheado: se reintenta la próxima vez
    throw error
  })
  return cachedMoon
}

/** Empieza la descarga en segundo plano (p. ej. durante la pantalla de introducción). */
export function preloadHighQualityMoon(options) {
  loadHighQualityMoon(options).catch((error) => console.warn('Luna de alta calidad no disponible:', error))
}

export function onHighQualityMoonProgress(listener) {
  progressListeners.add(listener)
  listener(cachedProgress)
  return () => progressListeners.delete(listener)
}
