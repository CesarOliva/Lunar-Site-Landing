// Prueba numérica de la orientación lunar: node moon/src/surface/lunarOrientation.test.mjs
import assert from 'node:assert/strict'
import { directionFromRaDec, inertialToMoonFixed, lunarRotation, starColor } from './lunarOrientation.js'

const apply = (matrix, vector) => matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2])
const close = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`)

// 1) Una matriz de rotación: ortonormal y de determinante +1.
const sample = inertialToMoonFixed(Date.UTC(2026, 10, 15, 12))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
for (let i = 0; i < 3; i += 1) {
  for (let j = 0; j < 3; j += 1) close(dot(sample[i], sample[j]), i === j ? 1 : 0, 1e-12, `fila ${i}·${j}`)
}
const det = dot(sample[0], [
  sample[1][1] * sample[2][2] - sample[1][2] * sample[2][1],
  sample[1][2] * sample[2][0] - sample[1][0] * sample[2][2],
  sample[1][0] * sample[2][1] - sample[1][1] * sample[2][0],
])
close(det, 1, 1e-12, 'determinante')

// 2) El polo norte de la Luna (α0, δ0) debe quedar en +z del marco fijo, a cualquier hora.
for (const time of [Date.UTC(2000, 0, 1, 12), Date.UTC(2026, 10, 15, 3), Date.UTC(2031, 5, 1, 18)]) {
  const { alpha0, delta0 } = lunarRotation(time)
  const pole = [Math.cos(delta0) * Math.cos(alpha0), Math.cos(delta0) * Math.sin(alpha0), Math.sin(delta0)]
  const [x, y, z] = apply(inertialToMoonFixed(time), pole)
  close(x, 0, 1e-12, 'polo x'); close(y, 0, 1e-12, 'polo y'); close(z, 1, 1e-12, 'polo z')
}

// 3) Valores publicados: a J2000 el polo norte de la Luna está en RA 266,86°, Dec 65,64°, y W avanza
//    13,176°/día (una vuelta cada 27,32 días).
const j2000 = lunarRotation(Date.UTC(2000, 0, 1, 12))
close((j2000.alpha0 * 180) / Math.PI, 266.86, 0.1, 'ascensión recta del polo a J2000')
close((j2000.delta0 * 180) / Math.PI, 65.64, 0.1, 'declinación del polo a J2000')
const day = 86400000
const dW = ((lunarRotation(Date.UTC(2026, 10, 15, 12) + day).W - lunarRotation(Date.UTC(2026, 10, 15, 12)).W) * 180) / Math.PI
close(((dW % 360) + 360) % 360, 13.176, 0.1, 'avance diario de W')

// 4) Giro del cielo: un día después una estrella fija se ha movido ~13,18° en longitud lunar.
const star = directionFromRaDec(101.287, -16.716) // Sirio
const lon = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI
const before = apply(inertialToMoonFixed(Date.UTC(2026, 10, 15, 12)), star)
const after = apply(inertialToMoonFixed(Date.UTC(2026, 10, 15, 12) + day), star)
const motion = ((lon(after) - lon(before) + 540) % 360) - 180
close(Math.abs(motion), 13.176, 0.1, 'giro del cielo en un día')
console.log(`giro del cielo: ${Math.abs(motion).toFixed(3)}°/día (periodo ${(360 / Math.abs(motion)).toFixed(2)} días)`)

// 5) Colores: las estrellas azules tienen más azul que rojo y las rojizas lo contrario; siempre en 0..1.
const blue = starColor(-0.2)
const red = starColor(1.6)
assert.ok(blue[2] > blue[0], 'estrella azul: más azul que rojo')
assert.ok(red[0] > red[2], 'estrella roja: más rojo que azul')
for (const channel of [...blue, ...red, ...starColor(0.6)]) assert.ok(channel >= 0 && channel <= 1)

console.log('lunarOrientation OK')
