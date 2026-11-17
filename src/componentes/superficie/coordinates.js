// Formato de coordenadas lunares: se muestran tal cual vienen de los datos (hasta 5 decimales, sin ceros
// sobrantes ni redondeos adicionales), with the hemisphere as a letter. East (E) positive, west (W) negative.
const trimmed = (value) => Number(Math.abs(value).toFixed(5))

export const formatLatitude = (value) => `${trimmed(value)}° ${value >= 0 ? 'N' : 'S'}`
export const formatLongitude = (value) => `${trimmed(value)}° ${value >= 0 ? 'E' : 'W'}`
export const formatCoordinates = ({ latitude, longitude }) => `${formatLatitude(latitude)} · ${formatLongitude(longitude)}`
