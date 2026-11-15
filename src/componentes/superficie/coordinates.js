// Formato de coordenadas lunares: se muestran tal cual vienen de los datos (hasta 5 decimales, sin ceros
// sobrantes ni redondeos adicionales), con el hemisferio en letra. Este (E) positivo, oeste (O) negativo.
const trimmed = (value) => Number(Math.abs(value).toFixed(5))

export const formatLatitude = (value) => `${trimmed(value)}° ${value >= 0 ? 'N' : 'S'}`
export const formatLongitude = (value) => `${trimmed(value)}° ${value >= 0 ? 'E' : 'O'}`
export const formatCoordinates = ({ latitude, longitude }) => `${formatLatitude(latitude)} · ${formatLongitude(longitude)}`
