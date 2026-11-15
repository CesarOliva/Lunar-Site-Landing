import { Cartesian3, Color, Matrix3, Matrix4, PointPrimitiveCollection } from 'cesium'
import stars from './data/stars.json'
import { DEFAULT_SKY_TIME_SCALE, directionFromRaDec, inertialToMoonFixed, starColor } from './lunarOrientation.js'

const SKY_DISTANCE_METERS = 2e8 // lejos de todo (la cámara no tiene paralaje), dentro del plano lejano de Cesium
const FAINTEST_MAGNITUDE = 6.1

/**
 * Cielo estrellado real para la vista de superficie: las 5.044 estrellas del catálogo Yale Bright Star hasta
 * magnitud 6 (el límite del ojo humano), con su brillo y su color (índice B−V).
 *
 * - Posiciones reales (J2000) orientadas con la rotación real de la Luna (ver lunarOrientation.js): desde la
 *   superficie el cielo gira una vuelta cada 27,32 días. `setTimeScale` acelera ese giro para poder verlo.
 * - Sin atmósfera las estrellas no titilan, así que brillan con luz fija.
 * - Se dibujan con prueba de profundidad: el horizonte y el relieve las ocultan.
 * - La nube se recentra en la cámara en cada fotograma, de modo que el cielo no tiene paralaje al caminar.
 */
export function createStarSky(viewer) {
  const { scene } = viewer
  const collection = scene.primitives.add(new PointPrimitiveCollection())

  for (const [ra, dec, magnitude, bv] of stars) {
    const [x, y, z] = directionFromRaDec(ra, dec)
    const brightness = Math.min(1, Math.max(0, (FAINTEST_MAGNITUDE - magnitude) / 7.5))
    const [red, green, blue] = starColor(bv)
    collection.add({
      position: new Cartesian3(x * SKY_DISTANCE_METERS, y * SKY_DISTANCE_METERS, z * SKY_DISTANCE_METERS),
      pixelSize: 1.7 + brightness * brightness * 5.6, // las más brillantes se ven más grandes
      color: new Color(red, green, blue, 0.62 + brightness * 0.38),
    })
  }

  let skyTimeMs = Date.now()
  let timeScale = DEFAULT_SKY_TIME_SCALE
  let previous = performance.now()
  const rotation = new Matrix3()
  const matrix = new Matrix4()

  const update = () => {
    const now = performance.now()
    skyTimeMs += (now - previous) * timeScale
    previous = now
    const m = inertialToMoonFixed(skyTimeMs)
    Matrix3.fromArray([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]], 0, rotation)
    collection.modelMatrix = Matrix4.fromRotationTranslation(rotation, scene.camera.positionWC, matrix)
  }
  scene.preRender.addEventListener(update)

  return {
    setTimeScale: (value) => { timeScale = value },
    dispose: () => {
      scene.preRender.removeEventListener(update)
      if (!scene.isDestroyed()) scene.primitives.remove(collection)
    },
  }
}
