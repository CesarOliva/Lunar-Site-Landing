// DEM LOLA (LRO) de 1024 px/grado (~30 m/píxel en el ecuador), entero de 16 bits, 0,5 m de resolución vertical.
// Fuente: NASA PDS Geosciences Node. Cada tesela cubre 30° de longitud x 15° de latitud y es un
// raster plano (fila mayor, norte arriba), así que se leen solo las filas necesarias con peticiones HTTP Range.
import { MOON_MEAN_RADIUS_KM } from './moonTiles.js'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const PDS_BASE = `${API_BASE}/pds/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img`
const PIXELS_PER_DEGREE = 1024
const TILE_LON_DEGREES = 30
const TILE_LAT_DEGREES = 15
const TILE_COLUMNS = TILE_LON_DEGREES * PIXELS_PER_DEGREE
const TILE_ROWS = TILE_LAT_DEGREES * PIXELS_PER_DEGREE
const METERS_PER_DN = 0.5
const MAX_PARALLEL_REQUESTS = 4

const pad = (value) => String(Math.abs(value)).padStart(2, '0')
const latLabel = (degrees, southSide) => (
  degrees < 0 || (degrees === 0 && southSide) ? `${pad(degrees)}s` : `${pad(degrees)}n`
)

function tileUrl(latBand, lonBand) {
  const latLow = -90 + latBand * TILE_LAT_DEGREES
  const latHigh = latLow + TILE_LAT_DEGREES
  const lonLow = lonBand * TILE_LON_DEGREES
  const lon = `${String(lonLow).padStart(3, '0')}_${String(lonLow + TILE_LON_DEGREES).padStart(3, '0')}`
  return `${PDS_BASE}/ldem_1024_${latLabel(latLow, false)}_${latLabel(latHigh, true)}_${lon}.img`
}

async function readBytes(url, start, length, signal) {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${start + length - 1}` },
    signal,
  })
  if (response.status !== 206 && !(response.status === 200 && start === 0)) {
    throw new Error(`LOLA PDS responded HTTP ${response.status} for ${url.split('/').pop()}.`)
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength < length) throw new Error('LOLA PDS returned incomplete data.')
  return new DataView(buffer)
}

const RANGES_PER_REQUEST = 128

function indexOfHeaderEnd(bytes, from) {
  for (let index = from; index + 3 < bytes.length; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10 && bytes[index + 2] === 13 && bytes[index + 3] === 10) return index
  }
  return -1
}

/**
 * Pide varios rangos de bytes en UNA petición (multipart/byteranges). Devuelve los trozos recibidos
 * como [{ start, bytes }]. Bajar solo las filas necesarias (~150 KB) en vez de las filas completas
 * de la tesela (~16 MB) es lo que hace rápida la carga de LOLA.
 */
async function readMultiRange(url, ranges, signal) {
  const response = await fetch(url, {
    headers: { Range: `bytes=${ranges.map((range) => `${range.start}-${range.end}`).join(',')}` },
    signal,
  })
  if (response.status !== 206) throw new Error(`LOLA PDS responded HTTP ${response.status} to the multi-range request.`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/byteranges')) {
    const single = /bytes (\d+)-(\d+)\//i.exec(response.headers.get('Content-Range') ?? '')
    if (!single) throw new Error('LOLA PDS returned a range response that cannot be interpreted.')
    return [{ start: Number(single[1]), bytes }]
  }

  const decoder = new TextDecoder('latin1')
  const parts = []
  let offset = 0
  while (offset < bytes.length) {
    const headerEnd = indexOfHeaderEnd(bytes, offset)
    if (headerEnd < 0) break
    const match = /Content-Range:\s*bytes\s+(\d+)-(\d+)\//i.exec(decoder.decode(bytes.subarray(offset, headerEnd)))
    if (!match) { offset = headerEnd + 4; continue }
    const start = Number(match[1])
    const length = Number(match[2]) - start + 1
    parts.push({ start, bytes: bytes.subarray(headerEnd + 4, headerEnd + 4 + length) })
    offset = headerEnd + 4 + length
  }
  return parts
}

function findPart(parts, start, length) {
  const part = parts.find((item) => start >= item.start && start + length <= item.start + item.bytes.length)
  if (!part) throw new Error('LOLA PDS did not return all the requested rows.')
  return new DataView(part.bytes.buffer, part.bytes.byteOffset + (start - part.start), length)
}

/**
 * Descarga una ventana de LOLA alrededor de (latitude, longitude) y devuelve un muestreador
 * `sample(latDeg, lonDeg)` -> altura en metros sobre la esfera de 1737,4 km (igual a la altura
 * elipsoidal en Cesium con Ellipsoid.MOON), o `undefined` si el punto queda fuera de la ventana.
 */
export async function loadLolaWindow(latitude, longitude, radiusKm, signal, onProgress) {
  const latRadius = (radiusKm / MOON_MEAN_RADIUS_KM) * (180 / Math.PI)
  if (Math.abs(latitude) + latRadius >= 89.9) {
    throw new Error('The point is too close to a pole for the cylindrical LOLA DEM.')
  }
  const lonRadius = latRadius / Math.cos(latitude * Math.PI / 180)
  const metersPerPixel = (2 * Math.PI * MOON_MEAN_RADIUS_KM * 1000) / 360 / PIXELS_PER_DEGREE

  // Ventana de píxeles necesaria (con margen para la interpolación bilineal).
  const lon360 = ((longitude % 360) + 360) % 360
  const rowMin = Math.floor((90 - (latitude + latRadius)) * PIXELS_PER_DEGREE - 0.5) - 1
  const rowMax = Math.ceil((90 - (latitude - latRadius)) * PIXELS_PER_DEGREE - 0.5) + 1
  const colMin = Math.floor((lon360 - lonRadius) * PIXELS_PER_DEGREE - 0.5) - 1
  const colMax = Math.ceil((lon360 + lonRadius) * PIXELS_PER_DEGREE - 0.5) + 1
  const globalColumns = 360 * PIXELS_PER_DEGREE
  const windowRows = rowMax - rowMin + 1
  const windowColumns = colMax - colMin + 1
  const window = new Float32Array(windowRows * windowColumns)

  // Una petición por fila y por tesela (la ventana puede cruzar el borde de 30° en longitud).
  const jobs = []
  for (let row = rowMin; row <= rowMax; row += 1) {
    const latBand = Math.floor(row / TILE_ROWS)
    const bandFromSouth = 11 - latBand
    let column = colMin
    while (column <= colMax) {
      const wrapped = ((column % globalColumns) + globalColumns) % globalColumns
      const lonBand = Math.floor(wrapped / TILE_COLUMNS)
      const inTile = wrapped - lonBand * TILE_COLUMNS
      const count = Math.min(colMax - column + 1, TILE_COLUMNS - inTile)
      jobs.push({ row, column, url: tileUrl(bandFromSouth, lonBand), tileRow: row - latBand * TILE_ROWS, inTile, count })
      column += count
    }
  }

  // Lotes de hasta RANGES_PER_REQUEST filas de una misma tesela, cada lote en una petición multirango.
  const batches = []
  let current = null
  for (const job of jobs) {
    if (!current || current.url !== job.url || current.jobs.length >= RANGES_PER_REQUEST) {
      current = { url: job.url, jobs: [] }
      batches.push(current)
    }
    current.jobs.push(job)
  }

  const store = (job, view, base) => {
    for (let index = 0; index < job.count; index += 1) {
      window[(job.row - rowMin) * windowColumns + (job.column - colMin) + index] =
        view.getInt16(base + index * 2, true) * METERS_PER_DN
    }
  }

  // Respaldo si el servidor no admite multirango: un único rango contiguo (más pesado pero compatible).
  const readContiguous = async (batch) => {
    const first = batch.jobs[0]
    const last = batch.jobs[batch.jobs.length - 1]
    const minSample = Math.min(...batch.jobs.map((job) => job.inTile))
    const maxSample = Math.max(...batch.jobs.map((job) => job.inTile + job.count))
    const start = (first.tileRow * TILE_COLUMNS + minSample) * 2
    const view = await readBytes(batch.url, start, (last.tileRow * TILE_COLUMNS + maxSample) * 2 - start, signal)
    for (const job of batch.jobs) {
      store(job, view, ((job.tileRow - first.tileRow) * TILE_COLUMNS + job.inTile - minSample) * 2)
    }
  }

  const progress = { loaded: 0, total: batches.length, failed: 0 }
  onProgress?.({ ...progress })
  let next = 0
  const workers = Array.from({ length: Math.min(MAX_PARALLEL_REQUESTS, batches.length) }, async () => {
    while (next < batches.length) {
      if (signal?.aborted) throw new DOMException('LOLA load cancelled.', 'AbortError')
      const batch = batches[next]
      next += 1
      try {
        const ranges = batch.jobs.map((job) => {
          const start = (job.tileRow * TILE_COLUMNS + job.inTile) * 2
          return { start, end: start + job.count * 2 - 1 }
        })
        const parts = await readMultiRange(batch.url, ranges, signal)
        batch.jobs.forEach((job, index) => store(job, findPart(parts, ranges[index].start, job.count * 2), 0))
      } catch (error) {
        if (error.name === 'AbortError') throw error
        console.warn('LOLA multi-range not available, using contiguous read:', error.message)
        await readContiguous(batch)
      }
      progress.loaded += 1
      onProgress?.({ ...progress })
    }
  })
  await Promise.all(workers)

  const sample = (rowF, columnF) => {
    const r = Math.min(windowRows - 1, Math.max(0, rowF - rowMin))
    const c = Math.min(windowColumns - 1, Math.max(0, columnF - colMin))
    const r0 = Math.floor(r)
    const c0 = Math.floor(c)
    const r1 = Math.min(windowRows - 1, r0 + 1)
    const c1 = Math.min(windowColumns - 1, c0 + 1)
    const tr = r - r0
    const tc = c - c0
    const top = window[r0 * windowColumns + c0] * (1 - tc) + window[r0 * windowColumns + c1] * tc
    const bottom = window[r1 * windowColumns + c0] * (1 - tc) + window[r1 * windowColumns + c1] * tc
    return top * (1 - tr) + bottom * tr
  }

  const west = lon360 - lonRadius
  const east = lon360 + lonRadius
  const south = latitude - latRadius
  const north = latitude + latRadius
  return {
    center: { latitude, longitude },
    radiusKm,
    metersPerPixel,
    requestCount: batches.length,
    bounds: { west, east, south, north },
    sample: (latDeg, lonDeg) => {
      // Normaliza la longitud al entorno del centro (maneja el salto 0/360).
      let lon = ((lonDeg % 360) + 360) % 360
      if (lon - lon360 > 180) lon -= 360
      else if (lon360 - lon > 180) lon += 360
      if (latDeg < south || latDeg > north || lon < west || lon > east) return undefined
      return sample((90 - latDeg) * PIXELS_PER_DEGREE - 0.5, lon * PIXELS_PER_DEGREE - 0.5)
    },
  }
}

// ---- Caché de sesión de ventanas LOLA -------------------------------------------------------
// Una ventana ocupa ~0,3 MB (solo las alturas, no los ~16 MB de filas de la tesela). Se reutiliza si el
// nuevo centro está a menos de REUSE_DISTANCE_KM de otra del mismo radio (el horizonte a pie queda a
// ~2,4 km, así que la ventana de 4 km sigue cubriéndolo). Se comparten también las cargas en curso,
// de modo que precargar al marcar el punto y luego entrar a la superficie no descarga dos veces.
const REUSE_DISTANCE_KM = 1
const MAX_CACHED_WINDOWS = 8
const cachedWindows = []

function distanceKm(latA, lonA, latB, lonB) {
  const toRadians = Math.PI / 180
  const dLat = (latB - latA) * toRadians
  const dLon = ((((lonB - lonA) + 540) % 360) - 180) * toRadians * Math.cos(((latA + latB) / 2) * toRadians)
  return Math.hypot(dLat, dLon) * MOON_MEAN_RADIUS_KM
}

export function loadLolaWindowCached(latitude, longitude, radiusKm, signal, onProgress) {
  let entry = cachedWindows.find((item) => (
    item.radiusKm === radiusKm
    && distanceKm(item.latitude, item.longitude, latitude, longitude) < REUSE_DISTANCE_KM
  ))
  if (!entry) {
    entry = { latitude, longitude, radiusKm, listeners: new Set(), lastProgress: null, hit: false }
    const controller = new AbortController() // la carga compartida no depende de ningún consumidor
    entry.promise = loadLolaWindow(latitude, longitude, radiusKm, controller.signal, (progress) => {
      entry.lastProgress = progress
      entry.listeners.forEach((listener) => listener(progress))
    })
    entry.promise.catch(() => {
      const index = cachedWindows.indexOf(entry)
      if (index >= 0) cachedWindows.splice(index, 1) // un fallo no debe quedar cacheado
    })
    cachedWindows.push(entry)
    if (cachedWindows.length > MAX_CACHED_WINDOWS) cachedWindows.shift()
  } else {
    entry.hit = true
  }

  if (onProgress) {
    entry.listeners.add(onProgress)
    if (entry.lastProgress) onProgress(entry.lastProgress)
  }
  const aborted = new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('LOLA load cancelled.', 'AbortError')), { once: true })
  })
  return Promise.race([entry.promise, aborted]).finally(() => onProgress && entry.listeners.delete(onProgress))
}
