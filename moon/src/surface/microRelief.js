// Microrrelieve lunar sintético por debajo de la resolución de LOLA (~30 m).
//
// NO es dato medido: extiende el relieve real con la estadística conocida de la superficie lunar,
// calibrada con la rugosidad local de LOLA:
//  - La topografía lunar es aproximadamente fractal (exponente de Hurst ~0,9): la variación de altura
//    a una distancia d crece como d^H. Se mide la variación a 1 muestra LOLA (~30 m) en la zona
//    elegida y se extrapola hacia escalas menores.
//  - Se añaden cráteres pequeños (cuencos con borde) con más cráteres cuanto más pequeños.
// Todo es determinista (misma posición => misma altura), así que terreno, textura y cámara coinciden.

const METERS_PER_DEGREE = (2 * Math.PI * 1737400) / 360
const HURST = 0.9
const LOLA_LAG_METERS = 29.6
const FBM_WAVELENGTHS = [48, 24, 12, 6, 3, 1.5, 0.75]
const CRATER_DIAMETERS = [4, 8, 16, 32]
const CRATER_CELL_FACTOR = 2.6
const CRATER_PROBABILITY = [0.55, 0.42, 0.3, 0.2]
// Ajuste medido con microRelief.test.mjs: hace que la variación sintética a 30 m coincida con la pedida.
const FBM_SCALE = 0.44

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function quintic(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const sx = quintic(x - x0)
  const sy = quintic(y - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return (a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy) * 2 - 1
}

/**
 * Mide la rugosidad local: desviación típica (m) de la variación de altura a una muestra LOLA
 * de distancia (~30 m), sin contar la pendiente regional. `sample(latDeg, lonDeg)` devuelve alturas LOLA en metros.
 */
export function measureRoughness(sample, latitude, longitude, radiusMeters = 1500) {
  const cosLat = Math.max(0.05, Math.cos((latitude * Math.PI) / 180))
  const lagNorth = LOLA_LAG_METERS / METERS_PER_DEGREE
  const lagEast = LOLA_LAG_METERS / (METERS_PER_DEGREE * cosLat)
  const steps = Math.floor((2 * radiusMeters) / LOLA_LAG_METERS)
  let sumSquares = 0
  let count = 0
  for (let row = 1; row < steps - 1; row += 1) {
    for (let column = 1; column < steps - 1; column += 1) {
      const lat = latitude + (row * LOLA_LAG_METERS - radiusMeters) / METERS_PER_DEGREE
      const lon = longitude + (column * LOLA_LAG_METERS - radiusMeters) / (METERS_PER_DEGREE * cosLat)
      const center = sample(lat, lon)
      // Diferencias de segundo orden: cancelan la pendiente regional (paredes de cráteres, laderas)
      // y dejan solo la rugosidad. Se dividen por sqrt(4 - 2^(2H)) para equivaler a la diferencia
      // de primer orden de un fractal con exponente de Hurst H.
      const second = [
        sample(lat, lon + lagEast) + sample(lat, lon - lagEast) - 2 * center,
        sample(lat + lagNorth, lon) + sample(lat - lagNorth, lon) - 2 * center,
      ]
      sumSquares += second[0] ** 2 + second[1] ** 2
      count += 2
    }
  }
  return Math.sqrt(sumSquares / count) / Math.sqrt(4 - 2 ** (2 * HURST))
}

/**
 * Crea la función de microrrelieve. `roughness` viene de measureRoughness (m a ~30 m de distancia),
 * `referenceLatitude` fija la proyección local (continua entre ventanas y teselas).
 */
export function createMicroRelief({ roughness, referenceLatitude, seed = 20260713, strength = 1 }) {
  const cosLat = Math.max(0.05, Math.cos((referenceLatitude * Math.PI) / 180))
  const rough = Math.min(Math.max(roughness, 0.15), 12) * strength
  const craterScale = Math.min(Math.max(roughness / 2.5, 0.1), 1.4) * strength

  const octaves = FBM_WAVELENGTHS.map((wavelength, index) => ({
    wavelength,
    amplitude: FBM_SCALE * rough * (wavelength / LOLA_LAG_METERS) ** HURST,
    cos: Math.cos(index * 0.93),
    sin: Math.sin(index * 0.93),
    offsetX: hash2(index, 11, seed) * 1000,
    offsetY: hash2(index, 23, seed) * 1000,
    seed: seed + index * 101,
  }))

  const toMeters = (latDeg, lonDeg) => [lonDeg * METERS_PER_DEGREE * cosLat, latDeg * METERS_PER_DEGREE]

  /**
   * Altura sintética (m) en (latDeg, lonDeg). `pixelMeters` es el tamaño de lo que se va a mostrar:
   * se omiten estructuras que no se podrían resolver (más finas que 2 píxeles).
   * `maxWavelength` omite estructuras grandes (las que la imagen real ya trae sombreadas).
   */
  function height(latDeg, lonDeg, pixelMeters = 0, maxWavelength = Infinity) {
    const [x, y] = toMeters(latDeg, lonDeg)
    let total = 0

    for (const octave of octaves) {
      if (octave.wavelength < pixelMeters * 2 || octave.wavelength > maxWavelength) continue
      const u = (x * octave.cos - y * octave.sin) / octave.wavelength + octave.offsetX
      const v = (x * octave.sin + y * octave.cos) / octave.wavelength + octave.offsetY
      total += octave.amplitude * valueNoise(u, v, octave.seed)
    }

    for (let bin = 0; bin < CRATER_DIAMETERS.length; bin += 1) {
      const diameter = CRATER_DIAMETERS[bin]
      if (diameter < pixelMeters * 4 || diameter > maxWavelength) continue
      const cell = diameter * CRATER_CELL_FACTOR
      const cellX = Math.floor(x / cell)
      const cellY = Math.floor(y / cell)
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const cx = cellX + offsetX
          const cy = cellY + offsetY
          const key = seed + bin * 7919
          if (hash2(cx, cy, key) > CRATER_PROBABILITY[bin]) continue
          const centerX = (cx + 0.15 + 0.7 * hash2(cx, cy, key + 1)) * cell
          const centerY = (cy + 0.15 + 0.7 * hash2(cx, cy, key + 2)) * cell
          const radius = (diameter / 2) * (0.7 + 0.6 * hash2(cx, cy, key + 3))
          const distance = Math.hypot(x - centerX, y - centerY) / radius
          if (distance > 2.2) continue
          const depth = radius * 2 * (0.1 + 0.08 * hash2(cx, cy, key + 4)) * craterScale
          if (distance < 1) {
            total += -depth * (1 - distance * distance) + 0.22 * depth * distance ** 4
          } else {
            const rim = Math.exp(-(((distance - 1) / 0.28) ** 2))
            total += 0.22 * depth * rim + 0.04 * depth * Math.exp(-(distance - 1) * 2.2)
          }
        }
      }
    }
    return total
  }

  /** Variación de albedo de grano fino (-1..1): regolito y rocas pequeñas no resueltos en la imagen. */
  function albedoNoise(latDeg, lonDeg, pixelMeters = 0) {
    const [x, y] = toMeters(latDeg, lonDeg)
    let total = 0
    let weight = 0
    for (let index = 0; index < 5; index += 1) {
      const wavelength = 2.2 / 2 ** index
      if (wavelength < pixelMeters * 2) continue
      const u = (x * 0.8 - y * 0.6) / wavelength + index * 91.7
      const v = (x * 0.6 + y * 0.8) / wavelength - index * 57.3
      total += valueNoise(u, v, seed + 7000 + index) / (index + 1)
      weight += 1 / (index + 1)
    }
    return weight ? total / weight : 0
  }

  return { height, albedoNoise, toMeters, strength, roughness: rough }
}
