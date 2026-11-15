const wmtsNamespace = 'http://www.opengis.net/wmts/1.0'
const owsNamespace = 'http://www.opengis.net/ows/1.1'
export const MOON_MEAN_RADIUS_KM = 1737.4
const catalogEndpoint = 'https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems'
const layerServicesEndpoint = 'https://trek.nasa.gov/moon/TrekServices/ws/index/getLayerServices'
const imageryCatalogQuery = new URLSearchParams({
  start: '0',
  rows: '200',
  facetKeys: 'itemType|productCat1|productCat2|serviceTypes|thumbnailURLDir',
  facetValues: 'product|Imagery|Mosaic|Mosaic|[* TO *]',
})

function firstText(element, namespace, tagName) {
  return element.getElementsByTagNameNS(namespace, tagName)[0]?.textContent?.trim() ?? ''
}

export async function readTileTemplate(layer, zoom, signal) {
  const response = await fetch(`${layer.endpoint}/1.0.0/WMTSCapabilities.xml`, { signal })
  if (!response.ok) {
    throw new Error(`NASA Trek no respondió las capacidades WMTS de ${layer.id} (${response.status}).`)
  }

  const document = new DOMParser().parseFromString(await response.text(), 'application/xml')
  if (document.querySelector('parsererror')) {
    throw new Error(`La respuesta WMTS de ${layer.id} no contiene XML válido.`)
  }

  const layerNode = [...document.getElementsByTagNameNS(wmtsNamespace, 'Layer')]
    .find((node) => firstText(node, owsNamespace, 'Identifier') === layer.id)
  const resource = layerNode?.getElementsByTagNameNS(wmtsNamespace, 'ResourceURL')[0]
  const matrixSetId = firstText(
    layerNode?.getElementsByTagNameNS(wmtsNamespace, 'TileMatrixSetLink')[0] ?? document,
    wmtsNamespace,
    'TileMatrixSet',
  )
  const matrixSet = [...document.getElementsByTagNameNS(wmtsNamespace, 'TileMatrixSet')]
    .find((node) => firstText(node, owsNamespace, 'Identifier') === matrixSetId)
  const matrices = matrixSet ? [...matrixSet.getElementsByTagNameNS(wmtsNamespace, 'TileMatrix')] : []
  const matrixMetadata = matrices.map((node) => ({
    matrixId: firstText(node, owsNamespace, 'Identifier'),
    tileWidth: Number(firstText(node, wmtsNamespace, 'TileWidth')),
    tileHeight: Number(firstText(node, wmtsNamespace, 'TileHeight')),
    matrixWidth: Number(firstText(node, wmtsNamespace, 'MatrixWidth')),
    matrixHeight: Number(firstText(node, wmtsNamespace, 'MatrixHeight')),
  }))
  const matrix = zoom === undefined
    ? undefined
    : matrixMetadata.find((item) => item.matrixId === String(zoom))

  if (!resource || (zoom !== undefined && !matrix)) {
    throw new Error(`No se encontró la matriz WMTS ${zoom} para ${layer.id}.`)
  }

  const template = resource.getAttribute('template')
  const style = firstText(layerNode.getElementsByTagNameNS(wmtsNamespace, 'Style')[0], owsNamespace, 'Identifier')

  if (!template || !style || (matrix && (
    !matrix.tileWidth || !matrix.tileHeight || !matrix.matrixWidth || !matrix.matrixHeight
  ))) {
    throw new Error(`La matriz WMTS de ${layer.id} está incompleta.`)
  }

  return {
    template: template.replace('/1.0.0//', '/1.0.0/'),
    style,
    matrixSetId,
    ...matrix,
    matrices: matrixMetadata,
  }
}

function makeTileUrl(template, { style, matrixSetId, matrixId }, row, column) {
  return template
    .replaceAll('{Style}', style)
    .replaceAll('{TileMatrixSet}', matrixSetId)
    .replaceAll('{TileMatrix}', matrixId)
    .replaceAll('{TileRow}', String(row))
    .replaceAll('{TileCol}', String(column))
}

export async function loadWmtsTiles(layer, zoom, signal, onProgress) {
  const matrix = await readTileTemplate(layer, zoom, signal)
  const canvas = document.createElement('canvas')
  canvas.width = matrix.tileWidth * matrix.matrixWidth
  canvas.height = matrix.tileHeight * matrix.matrixHeight

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error(`No se pudo crear el mosaico de teselas para ${layer.id}.`)

  const tiles = Array.from({ length: matrix.matrixWidth * matrix.matrixHeight }, (_, index) => ({
    row: Math.floor(index / matrix.matrixWidth),
    column: index % matrix.matrixWidth,
  }))
  let nextTile = 0
  let loaded = 0
  let failed = 0
  let lastError
  onProgress({ loaded, total: tiles.length, failed })

  const workers = Array.from({ length: 6 }, async () => {
    while (nextTile < tiles.length) {
      if (signal.aborted) throw new DOMException('Carga cancelada.', 'AbortError')
      const { row, column } = tiles[nextTile]
      nextTile += 1

      try {
        const response = await fetch(makeTileUrl(matrix.template, matrix, row, column), { signal })
        if (!response.ok) throw new Error(`Tesela ${row}/${column}: HTTP ${response.status}`)
        const bitmap = await createImageBitmap(await response.blob())
        context.drawImage(bitmap, column * matrix.tileWidth, row * matrix.tileHeight)
        bitmap.close()
        loaded += 1
      } catch (error) {
        if (signal.aborted) throw error
        lastError = error
        failed += 1
      }

      onProgress({ loaded, total: tiles.length, failed })
    }
  })

  await Promise.all(workers)
  if (loaded === 0) {
    throw new Error(`No se pudo descargar ninguna tesela WMTS de ${layer.id}. ${lastError?.message ?? ''}`)
  }

  const result = { canvas, loaded, failed, total: tiles.length, matrix }
  if (layer.kind === 'elevation') {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    return { ...result, pixels, width: canvas.width, height: canvas.height }
  }

  return result
}

export async function loadWmtsTile(layer, matrix, zoom, row, column, signal) {
  const requestedMatrix = matrix.matrices.find((item) => item.matrixId === String(zoom))
  if (!requestedMatrix) {
    throw new Error(`La matriz WMTS ${zoom} no está disponible para ${layer.id}.`)
  }

  const response = await fetch(
    makeTileUrl(matrix.template, { ...matrix, ...requestedMatrix }, row, column),
    { signal },
  )
  if (!response.ok) throw new Error(`Tesela ${row}/${column}: HTTP ${response.status}`)
  return createImageBitmap(await response.blob())
}

function getResolutionMetersPerPixel(product) {
  const label = String(product.productLabel ?? '')
  const metadata = `${product.title ?? ''} ${product.description ?? ''}`
  const titleCentimeters = metadata.match(/\b(\d+(?:[._]\d+)?)\s*cm(?:\s*(?:\/pixel|per pixel|pixel))?\b/i)
  const centimeters = label.match(/_(\d+(?:[._]\d+)?)cmp(?:_|$)/i)
  const mosaicCentimeters = label.match(/_(\d+(?:[._]\d+)?)cm(?:_|$)/i)
  if (centimeters) return Number(centimeters[1].replace('_', '.')) / 100
  if (mosaicCentimeters) return Number(mosaicCentimeters[1].replace('_', '.')) / 100
  if (titleCentimeters) return Number(titleCentimeters[1].replace('_', '.')) / 100

  const meters = label.match(/_(\d+(?:[._]\d+)?)(?:mpp|mp)(?:_|$)/i)
  if (meters) return Number(meters[1].replace('_', '.'))

  const pixelsPerDegree = label.match(/_(\d+)ppd(?:_|$)/i)
  if (pixelsPerDegree) {
    return ((2 * Math.PI * MOON_MEAN_RADIUS_KM * 1000) / 360) / Number(pixelsPerDegree[1])
  }

  const resolutionDegrees = Number(product.resolution)
  if (resolutionDegrees > 0) {
    return (resolutionDegrees * Math.PI / 180) * MOON_MEAN_RADIUS_KM * 1000
  }
  return Infinity
}

function productContainsPoint(product, latitude, longitude) {
  const bounds = String(product.bbox ?? '').split(',').map(Number)
  return bounds.length === 4
    && bounds.every(Number.isFinite)
    && longitude >= bounds[0] && longitude <= bounds[2]
    && latitude >= bounds[1] && latitude <= bounds[3]
}

async function readCatalogProducts(query, signal, label) {
  const response = await fetch(`${catalogEndpoint}?${query}`, { signal })
  if (!response.ok) {
    throw new Error(`NASA Trek no respondió el catálogo de ${label} (${response.status}).`)
  }

  const catalog = await response.json()
  if (!Array.isArray(catalog.response?.docs)) {
    throw new Error(`El catálogo de NASA Trek no devolvió una lista de ${label} válida.`)
  }
  return catalog.response.docs
}

async function readWmtsEndpoint(product, signal, kind) {
  const response = await fetch(
    `${layerServicesEndpoint}?uuid=${encodeURIComponent(product.item_UUID)}`,
    { signal },
  )
  if (!response.ok) {
    throw new Error(`No se encontró el servicio WMTS de ${product.productLabel} (${response.status}).`)
  }

  const serviceInfo = await response.json()
  const service = serviceInfo.response?.docs?.find((item) => (
    item.serviceType === 'Mosaic' && item.protocol === 'WMTS' && item.endPoint
  ))
  if (!service) throw new Error(`NASA Trek no publicó WMTS para ${product.productLabel}.`)

  return {
    id: product.productLabel,
    endpoint: service.endPoint,
    kind,
  }
}


/**
 * Capas de imagen de NASA Trek que cubren el punto, ordenadas de menor a mayor resolución
 * (la última es la mejor y debe dibujarse encima). Incluye el mosaico global y los
 * mosaicos regionales (p. ej. LROC NAC de ~0,3-0,5 m/píxel) cuyo bbox contiene el punto.
 */
// Cachés de sesión: ni el catálogo de Trek ni las capacidades WMTS dependen del punto elegido,
// así que se piden una sola vez (se guarda la promesa, también la de las peticiones en curso).
let catalogPromise = null
const layerInfoPromises = new Map()

function loadCatalogOnce() {
  catalogPromise ??= readCatalogProducts(imageryCatalogQuery, undefined, 'imagen')
    .catch((error) => {
      catalogPromise = null // un fallo no debe quedar cacheado
      throw error
    })
  return catalogPromise
}

function loadLayerInfoOnce(product) {
  const key = product.productLabel
  if (!layerInfoPromises.has(key)) {
    const promise = (async () => {
      const layer = await readWmtsEndpoint(product, undefined, 'imagery')
      const wmts = await readTileTemplate(layer, undefined, undefined)
      const levels = wmts.matrices.map((item) => Number(item.matrixId)).filter(Number.isInteger)
      const base = wmts.matrices.find((item) => item.matrixId === '0') ?? wmts.matrices[0]
      const [west, south, east, north] = String(product.bbox).split(',').map(Number)
      const maximumLevel = Math.max(...levels)
      // Resolución realmente servida por la pirámide WMTS (el nombre del producto indica la nominal,
      // pero Trek puede publicar niveles menos finos): grados por píxel del nivel máximo -> metros.
      const servedMetersPerPixel = (360 / (base.matrixWidth * 2 ** maximumLevel * base.tileWidth))
        * ((2 * Math.PI * MOON_MEAN_RADIUS_KM * 1000) / 360)
      return {
        id: product.productLabel,
        title: product.title,
        template: wmts.template,
        style: wmts.style,
        matrixSetId: wmts.matrixSetId,
        tileWidth: base.tileWidth,
        tileHeight: base.tileHeight,
        levelZeroTilesX: base.matrixWidth,
        levelZeroTilesY: base.matrixHeight,
        maximumLevel,
        bounds: { west, south, east, north },
        resolutionMetersPerPixel: servedMetersPerPixel,
        nominalMetersPerPixel: getResolutionMetersPerPixel(product),
      }
    })()
    promise.catch(() => layerInfoPromises.delete(key))
    layerInfoPromises.set(key, promise)
  }
  return layerInfoPromises.get(key)
}

/**
 * Capas de imagen de NASA Trek que cubren el punto, ordenadas de menor a mayor resolución servida
 * (la última es la mejor y debe dibujarse encima). Incluye el mosaico global y los mosaicos
 * regionales (p. ej. LROC NAC de ~0,3-0,5 m/píxel) cuyo bbox contiene el punto.
 * Catálogo y capacidades se descargan una vez por sesión; las peticiones en curso se comparten.
 */
export async function findImageryLayersForPoint(latitude, longitude, signal) {
  const products = await loadCatalogOnce()
  const candidates = products
    .filter((product) => (
      product.productCat1 === 'Imagery'
      && product.productCat2 === 'Mosaic'
      && product.serviceTypes?.includes('Mosaic')
      && Number.isFinite(getResolutionMetersPerPixel(product))
      && productContainsPoint(product, latitude, longitude)
    ))

  const settled = await Promise.allSettled(candidates.map(loadLayerInfoOnce))
  if (signal?.aborted) throw new DOMException('Búsqueda de imagen cancelada.', 'AbortError')

  const layers = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    // Mayor resolución servida al final (queda encima). Con la misma pirámide servida (p. ej. dos mosaicos
    // regionales hasta z15), gana el de menor resolución nominal, que es el que realmente trae más detalle.
    .sort((left, right) => (
      right.resolutionMetersPerPixel - left.resolutionMetersPerPixel
      || right.nominalMetersPerPixel - left.nominalMetersPerPixel
    ))
  if (!layers.length) {
    throw new Error('NASA Trek no ofrece mosaicos de imagen para el punto seleccionado.')
  }
  return layers
}
