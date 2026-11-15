// Orientación de la Luna en el espacio (modelo de rotación de la IAU, términos principales).
//
// Pasa direcciones del cielo (marco inercial ICRF/J2000: ascensión recta y declinación de las estrellas)
// al marco fijo de la Luna (x hacia longitud 0°, z hacia el polo norte), que es el que usa Cesium con el
// elipsoide lunar. Así el cielo se ve desde la superficie como es en realidad y gira a la velocidad real
// de la Luna: una vuelta cada 27,32 días.
//
// Fuente: IAU WGCCRE, parámetros de la Luna: polo (α0, δ0) y meridiano origen W con las libraciones
// principales (E1–E4). Precisión ~0,05°; se ignoran los términos menores (<0,03°).

const RAD = Math.PI / 180

/** Velocidad inicial del cielo: 1 hora de cielo real por segundo (≈0,55°/s), para que se note que gira. */
export const DEFAULT_SKY_TIME_SCALE = 3600
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
const MS_PER_DAY = 86400000

/** Argumentos de libración E1..E4 (grados) para d días desde J2000. */
function librationArguments(d) {
  return [
    125.045 - 0.0529921 * d,
    250.089 - 0.1059842 * d,
    260.008 + 13.0120009 * d,
    176.625 + 13.3407154 * d,
  ].map((degrees) => degrees * RAD)
}

/** Polo norte (α0, δ0) y meridiano origen W de la Luna, en radianes, para un instante (ms desde 1970 UTC). */
export function lunarRotation(timeMs) {
  const d = (timeMs - J2000_MS) / MS_PER_DAY
  const T = d / 36525
  const [E1, E2, E3, E4] = librationArguments(d)

  const alpha0 = (269.9949 + 0.0031 * T - 3.8787 * Math.sin(E1) - 0.1204 * Math.sin(E2)
    + 0.07 * Math.sin(E3) - 0.0172 * Math.sin(E4)) * RAD
  const delta0 = (66.5392 + 0.013 * T + 1.5419 * Math.cos(E1) + 0.0239 * Math.cos(E2)
    - 0.0278 * Math.cos(E3) + 0.0068 * Math.cos(E4)) * RAD
  const W = (38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * Math.sin(E1)
    + 0.1208 * Math.sin(E2) - 0.0642 * Math.sin(E3) + 0.0158 * Math.sin(E4)) * RAD
  return { alpha0, delta0, W }
}

const multiply = (a, b) => a.map((row) => [0, 1, 2].map((column) => (
  row[0] * b[0][column] + row[1] * b[1][column] + row[2] * b[2][column]
)))
// Rotaciones de marco (pasivas) alrededor de los ejes 3 (z) y 1 (x).
const rotation3 = (angle) => [
  [Math.cos(angle), Math.sin(angle), 0],
  [-Math.sin(angle), Math.cos(angle), 0],
  [0, 0, 1],
]
const rotation1 = (angle) => [
  [1, 0, 0],
  [0, Math.cos(angle), Math.sin(angle)],
  [0, -Math.sin(angle), Math.cos(angle)],
]

/** Matriz 3x3 (filas) que lleva un vector del marco inercial al marco fijo de la Luna: R3(W) R1(90°-δ0) R3(α0+90°). */
export function inertialToMoonFixed(timeMs) {
  const { alpha0, delta0, W } = lunarRotation(timeMs)
  return multiply(rotation3(W), multiply(rotation1(Math.PI / 2 - delta0), rotation3(alpha0 + Math.PI / 2)))
}

/** Vector unitario inercial de una ascensión recta y declinación (grados). */
export function directionFromRaDec(raDegrees, decDegrees) {
  const ra = raDegrees * RAD
  const dec = decDegrees * RAD
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

/**
 * Color aproximado (RGB 0..1) de una estrella a partir de su índice de color B−V: temperatura de cuerpo
 * negro y su color. Se mezcla con blanco porque a simple vista el color de las estrellas es sutil.
 */
export function starColor(bv) {
  const index = Math.min(2, Math.max(-0.4, bv))
  const kelvin = 4600 * (1 / (0.92 * index + 1.7) + 1 / (0.92 * index + 0.62))
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const blue = t >= 66 ? 255 : (t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)
  const clamp = (value) => Math.min(255, Math.max(0, value)) / 255
  const mix = 0.55 // fracción de color real; el resto es blanco
  return [red, green, blue].map((channel) => 1 - mix + mix * clamp(channel))
}
