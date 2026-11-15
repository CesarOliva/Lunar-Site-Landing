import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

// Cesium pesa ~1 MB comprimido: solo se descarga al entrar a la vista de superficie.
// Este archivo es un hook que devuelve JSX (no un componente): el aviso de Fast Refresh no aplica.
// eslint-disable-next-line react-refresh/only-export-components
const MoonSurface = lazy(() => import('./MoonSurface.jsx'))

const DEFAULT_CONTRAST = 1.6
const initialStatus = { phase: 'idle', terrain: { loaded: 0, total: 0 } }

/**
 * Estado y acciones de la vista de primera persona (CesiumJS + datos de NASA), sin interfaz.
 * Cada aplicación dibuja sus propios controles con lo que devuelve: así MOON y Landing comparten
 * la lógica y cada una conserva su diseño.
 *
 * `view` es el elemento del visor (llena su contenedor posicionado); el resto son datos y acciones.
 * `point` se usa tal cual (sin redondeos ni valores inventados): el recorrido empieza en esas coordenadas.
 * Cambiar de punto requiere montar el componente con una `key` nueva.
 */
export default function useSurfaceExplorer(point, { onInfo } = {}) {
  const surfaceRef = useRef(null)
  const detailTimer = useRef(0)
  const [info, setInfo] = useState(null)
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState('')
  const [tourActive, setTourActive] = useState(false)
  const [exaggeration, setExaggeration] = useState(1)
  const [detail, setDetail] = useState(1)
  const [contrast, setContrast] = useState(DEFAULT_CONTRAST)
  const [walker, setWalker] = useState(null)

  const handleStatus = useCallback((value) => setStatus((current) => ({ ...current, ...value })), [])
  // `onInfo` va por ref: un callback nuevo en cada render no debe recrear el visor.
  const onInfoRef = useRef(onInfo)
  useEffect(() => { onInfoRef.current = onInfo }, [onInfo])
  const handleReady = useCallback((value) => {
    setInfo(value)
    onInfoRef.current?.(value)
  }, [])
  const handleError = useCallback((message) => setError(message), [])

  const view = (
    <Suspense fallback={null}>
      <MoonSurface
        point={point}
        exaggeration={exaggeration}
        apiRef={surfaceRef}
        onStatus={handleStatus}
        onReady={handleReady}
        onError={handleError}
        onTourActiveChange={setTourActive}
        onPositionChange={setWalker}
      />
    </Suspense>
  )

  return {
    view,
    info,
    status,
    error,
    loading: !info && !error,
    tourActive,
    /** Posición actual de la cámara (la inicial hasta que el usuario camina). */
    position: walker ?? point,
    exaggeration,
    detail,
    contrast,
    /** La mejor capa de imagen activa (la que se ve), o undefined mientras carga. */
    bestImagery: info?.imagery.at(-1),
    toggleTour: () => surfaceRef.current?.setTourActive(!tourActive),
    walk: (direction, isMoving) => surfaceRef.current?.setWalkingDirection(direction, isMoving),
    changeExaggeration: (value) => setExaggeration(value),
    changeContrast: (value) => {
      setContrast(value)
      surfaceRef.current?.setContrast(value)
    },
    /** El detalle regenera teselas: se aplica 350 ms después del último movimiento del deslizador. */
    changeDetail: (value) => {
      setDetail(value)
      window.clearTimeout(detailTimer.current)
      detailTimer.current = window.setTimeout(() => surfaceRef.current?.setDetail(value), 350)
    },
    changeBaseImagery: (id) => surfaceRef.current?.setBaseImagery(id),
  }
}
