// Prueba numérica del microrrelieve: node src/surface/microRelief.test.mjs
import assert from 'node:assert/strict'
import { createMicroRelief, measureRoughness } from './microRelief.js'

const latitude = -43.3
const longitude = -11.36

// 1) Determinismo: misma posición => misma altura.
const relief = createMicroRelief({ roughness: 3, referenceLatitude: latitude })
assert.equal(relief.height(latitude, longitude), relief.height(latitude, longitude))

// 2) Calibración: la variación sintética a ~30 m debe parecerse a la rugosidad pedida (±35 %).
for (const target of [1, 3, 8]) {
  const calibrated = createMicroRelief({ roughness: target, referenceLatitude: latitude })
    const measured = measureRoughness(
    (lat, lon) => calibrated.height(lat, lon, 0),
    latitude,
    longitude,
  )
  const ratio = measured / target
  console.log(`rugosidad pedida ${target} m -> sintética medida ${measured.toFixed(2)} m (x${ratio.toFixed(2)})`)
  assert.ok(ratio > 0.6 && ratio < 1.5, `calibración fuera de rango para ${target}: x${ratio}`)
}

// 2b) Un plano inclinado (pendiente regional) no debe contar como rugosidad.
const slopeOnly = measureRoughness((lat, lon) => 5000 * (lat - latitude) + 3000 * (lon - longitude), latitude, longitude)
assert.ok(slopeOnly < 1e-3, `la pendiente regional se contó como rugosidad: ${slopeOnly}`)

// 3) Pendientes plausibles a escala métrica (la Luna: ~5-15° a 2-17 m de línea base).
const probe = createMicroRelief({ roughness: 3, referenceLatitude: latitude })
const slopes = []
for (let index = 0; index < 4000; index += 1) {
  const lat = latitude + (Math.sin(index * 12.9898) * 43758.5453 % 1) * 0.01
  const lon = longitude + (Math.sin(index * 78.233) * 43758.5453 % 1) * 0.01
  const here = probe.height(lat, lon)
  const east = probe.height(lat, lon + (4 / (30323 * Math.cos((latitude * Math.PI) / 180))))
  slopes.push((Math.atan(Math.abs(east - here) / 4) * 180) / Math.PI)
}
slopes.sort((a, b) => a - b)
const median = slopes[Math.floor(slopes.length / 2)]
console.log(`pendiente mediana a 4 m: ${median.toFixed(1)}°`)
assert.ok(median > 1.5 && median < 25, `pendiente mediana implausible: ${median}`)

// 4) Rendimiento: una tesela de terreno de 65x65 muestras.
const start = performance.now()
for (let row = 0; row < 65; row += 1) {
  for (let column = 0; column < 65; column += 1) {
    probe.height(latitude + row * 1e-5, longitude + column * 1e-5)
  }
}
const elapsed = performance.now() - start
console.log(`tesela 65x65: ${elapsed.toFixed(1)} ms`)
assert.ok(elapsed < 150, 'demasiado lento para generar teselas en tiempo real')

console.log('microRelief OK')
