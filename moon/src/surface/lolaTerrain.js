import { CustomHeightmapTerrainProvider, Ellipsoid, GeographicTilingScheme, Math as CesiumMath } from 'cesium'

const TILE_SAMPLES = 65
// LOLA 1024 ppd ≈ 29,6 m/muestra. Sin microrrelieve, más allá del nivel 12 (~14,6 m) solo se
// reinterpolaría; con microrrelieve se llega al nivel 15 (~1,8 m entre muestras).
const MAXIMUM_LEVEL_DATA_ONLY = 12
const MAXIMUM_LEVEL_WITH_RELIEF = 15
const EDGE = 1e-6
const METERS_PER_DEGREE = (2 * Math.PI * 1737400) / 360

/** Separación entre muestras (m) de una tesela del nivel dado. */
export function tileSpacingMeters(level) {
  return (180 / 2 ** level / (TILE_SAMPLES - 1)) * METERS_PER_DEGREE
}

/**
 * Altura LOLA (m sobre la esfera de 1737,4 km) en (latDeg, lonDeg).
 * Fuera de la ventana devuelve la altura del borde más cercano.
 */
export function sampleLolaHeight(window, latDeg, lonDeg) {
  const { south, north, west, east } = window.bounds
  const center360 = ((window.center.longitude % 360) + 360) % 360
  const lonOffset = ((((lonDeg - window.center.longitude) + 540) % 360) + 360) % 360 - 180
  const latitude = Math.min(north - EDGE, Math.max(south + EDGE, latDeg))
  const longitude = Math.min(east - EDGE, Math.max(west + EDGE, center360 + lonOffset))
  return window.sample(latitude, longitude) ?? 0
}

/**
 * Altura del terreno = LOLA real + (opcional) microrrelieve sintético calibrado.
 * `pixelMeters` es la resolución a la que se va a mostrar, para omitir lo que no se resuelve.
 */
export function terrainHeight(window, relief, latDeg, lonDeg, pixelMeters = 0) {
  const base = sampleLolaHeight(window, latDeg, lonDeg)
  return relief ? base + relief.height(latDeg, lonDeg, pixelMeters) : base
}

/**
 * Proveedor de terreno de Cesium con alturas LOLA (PDS) de una ventana local y, si se da
 * `relief`, microrrelieve sintético. `window` es el resultado de `loadLolaWindow`.
 */
export function createLolaTerrainProvider(window, relief = null) {
  const tilingScheme = new GeographicTilingScheme({ ellipsoid: Ellipsoid.MOON })
  const step = TILE_SAMPLES - 1
  const maximumLevel = relief ? MAXIMUM_LEVEL_WITH_RELIEF : MAXIMUM_LEVEL_DATA_ONLY

  const provider = new CustomHeightmapTerrainProvider({
    width: TILE_SAMPLES,
    height: TILE_SAMPLES,
    tilingScheme,
    ellipsoid: Ellipsoid.MOON,
    callback: (x, y, level) => {
      const rectangle = tilingScheme.tileXYToRectangle(x, y, level)
      const spacing = tileSpacingMeters(level)
      const heights = new Float32Array(TILE_SAMPLES * TILE_SAMPLES)
      for (let row = 0; row < TILE_SAMPLES; row += 1) {
        const latitude = CesiumMath.toDegrees(
          rectangle.north - ((rectangle.north - rectangle.south) * row) / step,
        )
        for (let column = 0; column < TILE_SAMPLES; column += 1) {
          const longitude = CesiumMath.toDegrees(
            rectangle.west + ((rectangle.east - rectangle.west) * column) / step,
          )
          heights[row * TILE_SAMPLES + column] = terrainHeight(window, relief, latitude, longitude, spacing)
        }
      }
      return heights
    },
  })

  provider.getTileDataAvailable = (x, y, level) => level <= maximumLevel
  return provider
}
