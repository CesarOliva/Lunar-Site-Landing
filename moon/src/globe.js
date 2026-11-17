import * as THREE from 'three'

// Capas WMTS del globo: mosaico de imagen LRO WAC (303 ppd) y modelo de elevación LOLA (128 ppd).
export const imageryLayer = {
  id: 'LRO_WAC_Mosaic_Global_303ppd_v02',
  endpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02',
  kind: 'imagery',
}

export const elevationLayer = {
  id: 'LRO_LOLA_DEM_Global_128ppd_v04',
  endpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_DEM_Global_128ppd_v04',
  kind: 'elevation',
}

/** Radio de la esfera del globo (unidades de escena). */
export const GLOBE_RADIUS = 2

/**
 * Giro de la esfera alrededor de Y para que la longitud 0° mire hacia +Z con el este a la derecha
 * (la misma convención que usa el resto de la aplicación: x = cos(lat)·sin(lon), z = cos(lat)·cos(lon)).
 * SphereGeometry coloca la columna de textura de longitud L en (cos L, ., -sin L).
 */
export const GLOBE_ROTATION = -Math.PI / 2

/** Dirección unitaria, en el sistema local de la esfera SIN girar, de una latitud/longitud lunar. */
export function directionFromLatLon(latitudeDegrees, longitudeDegrees) {
  const latitude = THREE.MathUtils.degToRad(latitudeDegrees)
  const longitude = THREE.MathUtils.degToRad(longitudeDegrees)
  return new THREE.Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  )
}

/** Inversa de `directionFromLatLon`: latitud y longitud (grados, este positivo) de una dirección local. */
export function latLonFromDirection(direction) {
  const unit = direction.clone().normalize()
  return {
    latitude: THREE.MathUtils.radToDeg(Math.asin(unit.y)),
    longitude: THREE.MathUtils.radToDeg(Math.atan2(-unit.z, unit.x)),
  }
}

/**
 * Esfera con relieve a partir de la elevación de 8 bits descargada (relieve exagerado, solo visual).
 * `qualityLevel` 3 = 256 teselas entre imagen y relieve ("Alta").
 */
export function createTerrainGeometry(elevation, qualityLevel) {
  const resolutionScale = 2 ** (qualityLevel - 2)
  const geometry = new THREE.SphereGeometry(
    GLOBE_RADIUS,
    Math.round(384 * resolutionScale),
    Math.round(192 * resolutionScale),
  )
  const positions = geometry.attributes.position
  const uvs = geometry.attributes.uv
  const { pixels, width, height } = elevation
  const direction = new THREE.Vector3()

  for (let index = 0; index < positions.count; index += 1) {
    const u = uvs.getX(index)
    const v = uvs.getY(index)
    const x = Math.min(width - 1, Math.floor(u * width))
    const y = Math.min(height - 1, Math.floor((1 - v) * height))
    const pixelIndex = (y * width + x) * 4
    const intensity = pixels[pixelIndex]
    const alpha = pixels[pixelIndex + 3] / 255
    const radius = GLOBE_RADIUS + ((intensity / 255) - 0.5) * 0.045 * alpha
    direction.fromBufferAttribute(positions, index).normalize()

    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius)
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}
