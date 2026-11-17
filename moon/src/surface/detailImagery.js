import { Cartographic } from 'cesium'
import { sampleLolaHeight } from './lolaTerrain.js'
import { LruCache } from './lru.js'

const MOON_RADIUS_METERS = 1737400
const EXTRA_LEVELS = 7
const PARENT_CACHE_SIZE = 32
const GRID_SIZE = 128
const SHADE_GAIN = 1.9 // el sombreado fino real es más contrastado que la pendiente suave de la imagen base
// Teselas con detalle ya generadas (generarlas cuesta 5-18 ms de CPU cada una). 240 x 256 KB ≈ 63 MB; una pasada de la vista usa ~170.
export const detailTileCache = new LruCache(240)

// Teselas nativas con el realce de contraste ya aplicado (~4 ms cada una). 200 x 256 KB ≈ 52 MB.
export const enhancedTileCache = new LruCache(200)

// Realce local multiescala: resalta lo que se distingue de su entorno (bordes y sombras de cráteres,
// escarpes, rocas) sin cambiar el brillo medio. Escala fina (~3 px) y media (~12 px).
const ENHANCE_FINE_RADIUS = 3
const ENHANCE_WIDE_RADIUS = 12
const ENHANCE_FINE_GAIN = 1.0
const ENHANCE_WIDE_GAIN = 0.6

function boxBlur(source, width, height, radius) {
  const horizontal = new Float32Array(source.length)
  const output = new Float32Array(source.length)
  const size = radius * 2 + 1
  for (let row = 0; row < height; row += 1) {
    const offset = row * width
    let sum = 0
    for (let k = -radius; k <= radius; k += 1) sum += source[offset + Math.min(width - 1, Math.max(0, k))]
    for (let column = 0; column < width; column += 1) {
      horizontal[offset + column] = sum / size
      sum += source[offset + Math.min(width - 1, column + radius + 1)] - source[offset + Math.max(0, column - radius)]
    }
  }
  for (let column = 0; column < width; column += 1) {
    let sum = 0
    for (let k = -radius; k <= radius; k += 1) sum += horizontal[Math.min(height - 1, Math.max(0, k)) * width + column]
    for (let row = 0; row < height; row += 1) {
      output[row * width + column] = sum / size
      sum += horizontal[Math.min(height - 1, row + radius + 1) * width + column]
        - horizontal[Math.max(0, row - radius) * width + column]
    }
  }
  return output
}

/** Devuelve un canvas con la imagen y el contraste local realzado. */
export function enhanceLocalContrast(image, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, width, height)
  const picture = context.getImageData(0, 0, width, height)
  const data = picture.data
  const luminance = new Float32Array(width * height)
  for (let index = 0; index < luminance.length; index += 1) {
    luminance[index] = (data[index * 4] + data[index * 4 + 1] + data[index * 4 + 2]) / 765
  }
  const fine = boxBlur(luminance, width, height, ENHANCE_FINE_RADIUS)
  const wide = boxBlur(luminance, width, height, ENHANCE_WIDE_RADIUS)
  for (let index = 0; index < luminance.length; index += 1) {
    const value = luminance[index]
    const target = value + ENHANCE_FINE_GAIN * (value - fine[index]) + ENHANCE_WIDE_GAIN * (value - wide[index])
    const factor = Math.min(2.4, Math.max(0.35, target / Math.max(value, 0.02)))
    data[index * 4] = Math.min(255, data[index * 4] * factor)
    data[index * 4 + 1] = Math.min(255, data[index * 4 + 1] * factor)
    data[index * 4 + 2] = Math.min(255, data[index * 4 + 2] * factor)
  }
  context.putImageData(picture, 0, 0)
  return canvas
}

const DEFAULT_SUN = { azimuth: Math.PI / 2, elevation: (30 * Math.PI) / 180, estimated: false }

/**
 * Envuelve un proveedor de imagen de Cesium y lo extiende por debajo de su resolución nativa:
 * en los niveles extra recorta la tesela del nivel máximo y le añade (1) el sombreado del
 * microrrelieve sintético, con la dirección del sol estimada de la propia imagen, y (2) grano
 * fino de albedo. La imagen nativa no se modifica. El resultado coincide con el terreno de
 * `terrainHeight` porque ambos usan la misma función de microrrelieve.
 */
export class DetailImageryProvider {
  constructor(inner, { relief, getStrength, getSun, sunReady, getSignature, enhance = true, cacheId = '' }) {
    this.inner = inner
    this.enhance = enhance
    this.cacheId = cacheId
    // Los niveles extra esperan a la estimación del sol (necesaria para sombrear); los niveles nativos no.
    this.sunReady = sunReady ?? Promise.resolve()
    this.getSignature = getSignature
    this.relief = relief
    this.getStrength = getStrength
    this.getSun = getSun
    this.nativeMaximumLevel = inner.maximumLevel
    this.nativePixelMeters = ((180 / 2 ** inner.maximumLevel) * Math.PI / 180 * MOON_RADIUS_METERS) / inner.tileHeight
    this.parents = new Map()
  }

  get rectangle() { return this.inner.rectangle }
  get tileWidth() { return this.inner.tileWidth }
  get tileHeight() { return this.inner.tileHeight }
  get minimumLevel() { return this.inner.minimumLevel }
  get maximumLevel() { return this.inner.maximumLevel + (this.relief ? EXTRA_LEVELS : 0) }
  get tilingScheme() { return this.inner.tilingScheme }
  get tileDiscardPolicy() { return this.inner.tileDiscardPolicy }
  get errorEvent() { return this.inner.errorEvent }
  get credit() { return this.inner.credit }
  get proxy() { return this.inner.proxy }
  get hasAlphaChannel() { return false }
  get ready() { return true }

  pickFeatures() { return undefined }

  /** Tesela nativa (con realce de contraste local si está activo), cacheada por sesión. */
  async nativeImage(x, y, level, request) {
    const image = await this.inner.requestImage(x, y, level, request)
    if (!image || !this.enhance) return image
    const key = `${this.cacheId}|enh|${level}/${x}/${y}`
    const cached = enhancedTileCache.get(key)
    if (cached) return cached
    const enhanced = enhanceLocalContrast(image, this.tileWidth, this.tileHeight)
    enhancedTileCache.set(key, enhanced)
    return enhanced
  }

  loadParent(x, y) {
    const key = `${x}/${y}`
    let entry = this.parents.get(key)
    if (!entry) {
      entry = this.nativeImage(x, y, this.nativeMaximumLevel)
      this.parents.set(key, entry)
      if (this.parents.size > PARENT_CACHE_SIZE) this.parents.delete(this.parents.keys().next().value)
      entry.catch(() => this.parents.delete(key))
    }
    return entry
  }

  async requestImage(x, y, level, request) {
    if (level <= this.nativeMaximumLevel) return this.nativeImage(x, y, level, request)

    const depth = level - this.nativeMaximumLevel
    const scale = 2 ** depth
    const parentX = Math.floor(x / scale)
    const parentY = Math.floor(y / scale)
    // La tesela base se descarga a la vez que se estima el sol, no después.
    const [parent] = await Promise.all([this.loadParent(parentX, parentY), this.sunReady])
    if (!parent) return undefined

    const strength = this.getStrength()
    const cacheKey = this.getSignature ? `${this.getSignature()}|${level}/${x}/${y}` : null
    const cached = cacheKey && detailTileCache.get(cacheKey)
    if (cached) return cached

    const width = this.tileWidth
    const height = this.tileHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const sourceWidth = width / scale
    const sourceHeight = height / scale
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      parent,
      (x - parentX * scale) * sourceWidth,
      (y - parentY * scale) * sourceHeight,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    )
    if (strength > 0 && this.relief) this.addDetail(context, x, y, level, strength)
    if (cacheKey) detailTileCache.set(cacheKey, canvas)
    return canvas
  }

  addDetail(context, x, y, level, strength) {
    const width = this.tileWidth
    const height = this.tileHeight
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, level)
    const toDegrees = 180 / Math.PI
    const north = rectangle.north * toDegrees
    const south = rectangle.south * toDegrees
    const west = rectangle.west * toDegrees
    const east = rectangle.east * toDegrees
    const centerLatitude = (north + south) / 2
    const pixelNorthMeters = ((rectangle.north - rectangle.south) * MOON_RADIUS_METERS) / height
    const pixelEastMeters = ((rectangle.east - rectangle.west) * MOON_RADIUS_METERS * Math.cos(centerLatitude / toDegrees)) / width

    // Relieve sintético en una malla de GRID_SIZE + 2 (con borde) para obtener pendientes.
    const gridStride = GRID_SIZE + 2
    const gridMeters = pixelNorthMeters * (height / GRID_SIZE)
    const gridEastMeters = pixelEastMeters * (width / GRID_SIZE)
    const heights = new Float32Array(gridStride * gridStride)
    // Lo que la imagen real ya trae sombreado (estructuras de más de ~2 píxeles nativos) no se repite.
    const maxWavelength = this.nativePixelMeters * 2
    for (let row = 0; row < gridStride; row += 1) {
      const latitude = north - ((row - 0.5) / GRID_SIZE) * (north - south)
      for (let column = 0; column < gridStride; column += 1) {
        const longitude = west + ((column - 0.5) / GRID_SIZE) * (east - west)
        heights[row * gridStride + column] = this.relief.height(latitude, longitude, gridMeters, maxWavelength)
      }
    }

    const sun = this.getSun() ?? DEFAULT_SUN
    const elevation = sun.elevation
    const sunEast = Math.cos(elevation) * Math.sin(sun.azimuth)
    const sunNorth = Math.cos(elevation) * Math.cos(sun.azimuth)
    const sunUp = Math.sin(elevation)

    const shade = new Float32Array(GRID_SIZE * GRID_SIZE)
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let column = 0; column < GRID_SIZE; column += 1) {
        const center = (row + 1) * gridStride + column + 1
        const gradientEast = (heights[center + 1] - heights[center - 1]) / (2 * gridEastMeters)
        const gradientNorth = (heights[center - gridStride] - heights[center + gridStride]) / (2 * gridMeters)
        const inverseLength = 1 / Math.hypot(gradientEast, gradientNorth, 1)
        const lit = (-gradientEast * sunEast - gradientNorth * sunNorth + sunUp) * inverseLength
        shade[row * GRID_SIZE + column] = Math.min(1.6, Math.max(0.35, lit / sunUp))
      }
    }

    const image = context.getImageData(0, 0, width, height)
    const data = image.data
    const shadeStrength = Math.min(2.4, SHADE_GAIN * strength)
    const grainStrength = 0.12 * strength
    const pixelMeters = Math.min(pixelNorthMeters, pixelEastMeters)
    for (let row = 0; row < height; row += 1) {
      const gridRow = Math.min(GRID_SIZE - 1.001, Math.max(0, (row + 0.5) * (GRID_SIZE / height) - 0.5))
      const row0 = Math.floor(gridRow)
      const rowT = gridRow - row0
      const latitude = north - ((row + 0.5) / height) * (north - south)
      for (let column = 0; column < width; column += 1) {
        const gridColumn = Math.min(GRID_SIZE - 1.001, Math.max(0, (column + 0.5) * (GRID_SIZE / width) - 0.5))
        const column0 = Math.floor(gridColumn)
        const columnT = gridColumn - column0
        const top = shade[row0 * GRID_SIZE + column0] * (1 - columnT) + shade[row0 * GRID_SIZE + column0 + 1] * columnT
        const bottom = shade[(row0 + 1) * GRID_SIZE + column0] * (1 - columnT) + shade[(row0 + 1) * GRID_SIZE + column0 + 1] * columnT
        const shading = top * (1 - rowT) + bottom * rowT
        const longitude = west + ((column + 0.5) / width) * (east - west)
        const grain = 1 + grainStrength * this.relief.albedoNoise(latitude, longitude, pixelMeters)
        const factor = (1 + shadeStrength * (shading - 1)) * grain
        const index = (row * width + column) * 4
        data[index] = Math.min(255, data[index] * factor)
        data[index + 1] = Math.min(255, data[index + 1] * factor)
        data[index + 2] = Math.min(255, data[index + 2] * factor)
      }
    }
    context.putImageData(image, 0, 0)
  }
}

/**
 * Estima la dirección del sol de la imagen: el brillo de un píxel depende de cuánto mira su
 * pendiente al sol, así que se ajusta brillo ≈ b0 + cE·dh/dE + cN·dh/dN sobre alturas LOLA reales.
 * El sol queda en dirección (-cE, -cN) y su elevación es atan(b0 / |c|).
 */
export async function estimateSunDirection(provider, lolaWindow, latitude, longitude) {
  try {
    const source = provider.inner ?? provider
    const level = source.maximumLevel
    const scheme = source.tilingScheme
    const tile = scheme.positionToTileXY(Cartographic.fromDegrees(longitude, latitude), level)
    const image = await source.requestImage(tile.x, tile.y, level)
    if (!image) return DEFAULT_SUN

    const width = source.tileWidth
    const height = source.tileHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data

    const rectangle = scheme.tileXYToRectangle(tile.x, tile.y, level)
    const toDegrees = 180 / Math.PI
    const pixelNorth = ((rectangle.north - rectangle.south) * MOON_RADIUS_METERS) / height
    const pixelEast = ((rectangle.east - rectangle.west) * MOON_RADIUS_METERS * Math.cos(rectangle.north / 2 + rectangle.south / 2)) / width
    const lag = Math.max(2, Math.round(45 / pixelNorth)) // ~45 m: LOLA (30 m) solo resuelve pendientes a esta escala

    // Brillo suavizado a la misma escala que el gradiente (imagen integral): el albedo y las sombras
    // finas de la foto no se pueden explicar con la pendiente de LOLA y solo añaden ruido.
    const integral = new Float64Array((width + 1) * (height + 1))
    for (let row = 0; row < height; row += 1) {
      let rowSum = 0
      for (let column = 0; column < width; column += 1) {
        const index = (row * width + column) * 4
        rowSum += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 765
        integral[(row + 1) * (width + 1) + column + 1] = integral[row * (width + 1) + column + 1] + rowSum
      }
    }
    const meanBrightness = integral[height * (width + 1) + width] / (width * height)
    const smoothBrightness = (row, column) => {
      const r0 = Math.max(0, row - lag)
      const r1 = Math.min(height, row + lag + 1)
      const c0 = Math.max(0, column - lag)
      const c1 = Math.min(width, column + lag + 1)
      const total = integral[r1 * (width + 1) + c1] - integral[r0 * (width + 1) + c1]
        - integral[r1 * (width + 1) + c0] + integral[r0 * (width + 1) + c0]
      return total / ((r1 - r0) * (c1 - c0))
    }
    const heightAt = (row, column) => sampleLolaHeight(
      lolaWindow,
      (rectangle.north - ((row + 0.5) / height) * (rectangle.north - rectangle.south)) * toDegrees,
      (rectangle.west + ((column + 0.5) / width) * (rectangle.east - rectangle.west)) * toDegrees,
    )
    const { south, north, west, east } = lolaWindow.bounds
    const inside = (row, column) => {
      const lat = (rectangle.north - ((row + 0.5) / height) * (rectangle.north - rectangle.south)) * toDegrees
      let lon = (rectangle.west + ((column + 0.5) / width) * (rectangle.east - rectangle.west)) * toDegrees
      lon = ((lon % 360) + 360) % 360
      return lat > south && lat < north && lon > west && lon < east
    }

    // Mínimos cuadrados: b = b0 + cE*gE + cN*gN
    const normal = Array.from({ length: 3 }, () => [0, 0, 0])
    const right = [0, 0, 0]
    let count = 0
    let sumBrightness = 0
    let sumSquares = 0
    for (let row = lag; row < height - lag; row += 3) {
      for (let column = lag; column < width - lag; column += 3) {
        if (!inside(row, column) || !inside(row - lag, column - lag) || !inside(row + lag, column + lag)) continue
        const gradientEast = (heightAt(row, column + lag) - heightAt(row, column - lag)) / (2 * lag * pixelEast)
        const gradientNorth = (heightAt(row - lag, column) - heightAt(row + lag, column)) / (2 * lag * pixelNorth)
        const brightness = smoothBrightness(row, column)
        const features = [1, gradientEast, gradientNorth]
        for (let a = 0; a < 3; a += 1) {
          right[a] += features[a] * brightness
          for (let b = 0; b < 3; b += 1) normal[a][b] += features[a] * features[b]
        }
        count += 1
        sumBrightness += brightness
        sumSquares += brightness * brightness
      }
    }
    if (count < 200) {
      console.debug('[sun] too few valid points', count)
      return { ...DEFAULT_SUN, meanBrightness }
    }

    const solution = solve3(normal, right)
    if (!solution) return { ...DEFAULT_SUN, meanBrightness }
    const [b0, coefficientEast, coefficientNorth] = solution
    const variance = sumSquares / count - (sumBrightness / count) ** 2
    const explained = (coefficientEast * (right[1] - normal[1][0] * sumBrightness / count) + coefficientNorth * (right[2] - normal[2][0] * sumBrightness / count)) / count
    const correlation = Math.sqrt(Math.max(0, explained / Math.max(variance, 1e-9)))
    const magnitude = Math.hypot(coefficientEast, coefficientNorth)
    console.debug('[sun]', { count, b0, coefficientEast, coefficientNorth, correlation })
    if (correlation < 0.12 || magnitude < 1e-6) return { ...DEFAULT_SUN, correlation, meanBrightness }

    const elevation = Math.min((55 * Math.PI) / 180, Math.max((15 * Math.PI) / 180, Math.atan2(Math.abs(b0), magnitude)))
    return {
      azimuth: Math.atan2(-coefficientEast, -coefficientNorth),
      elevation,
      correlation,
      meanBrightness,
      estimated: true,
    }
  } catch (error) {
    console.debug('[sun] error', error)
    return DEFAULT_SUN
  }
}

function solve3(matrix, vector) {
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < 3; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 3; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row
    if (Math.abs(a[pivot][column]) < 1e-12) return null
    ;[a[column], a[pivot]] = [a[pivot], a[column]]
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue
      const factor = a[row][column] / a[column][column]
      for (let k = column; k < 4; k += 1) a[row][k] -= factor * a[column][k]
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]]
}

/**
 * Brillo medio (0..1) de la tesela nativa de una capa en un punto, ignorando los píxeles sin datos
 * (transparentes o casi negros, p. ej. fuera de un mosaico NAC). Sirve para normalizar capas oscuras
 * antes de aplicar contraste, que gira en torno a 0,5. Devuelve `null` si no se puede medir.
 */
export async function measureMeanBrightness(provider, latitude, longitude) {
  try {
    const source = provider.inner ?? provider
    const level = source.maximumLevel
    const tile = source.tilingScheme.positionToTileXY(Cartographic.fromDegrees(longitude, latitude), level)
    const image = await source.requestImage(tile.x, tile.y, level)
    if (!image) return null
    const width = source.tileWidth
    const height = source.tileHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0, width, height)
    const data = context.getImageData(0, 0, width, height).data
    let total = 0
    let count = 0
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 250) continue
      const value = (data[index] + data[index + 1] + data[index + 2]) / 765
      if (value < 0.02) continue
      total += value
      count += 1
    }
    return count > 200 ? total / count : null
  } catch {
    return null
  }
}
