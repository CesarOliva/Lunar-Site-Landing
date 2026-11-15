import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import SurfaceExplorer from './surface/SurfaceExplorer.jsx'
import './App.css'

const MoonScene = lazy(() => import('./MoonScene.jsx'))

const initialProgress = {
  imagery: { loaded: 0, total: 0, failed: 0 },
  elevation: { loaded: 0, total: 0, failed: 0 },
}

// Zonas con mosaico LROC NAC de ~0,5 m/píxel en NASA Trek (centros de sus bbox).
const nacSites = [
  { name: 'Tycho (NAC 0,5 m)', latitude: -42.98, longitude: -11.2 },
  { name: 'Apolo 11', latitude: 0.64, longitude: 23.49 },
  { name: 'Apolo 12', latitude: -3.0, longitude: -23.4 },
  { name: 'Apolo 14', latitude: -3.7, longitude: -17.44 },
  { name: 'Apolo 15', latitude: 26.28, longitude: 3.63 },
  { name: 'Apolo 16', latitude: -9.13, longitude: 15.47 },
  { name: 'Apolo 17', latitude: 20.3, longitude: 30.8 },
  { name: 'Von Kármán', latitude: -45.5, longitude: 175.7 },
]

const qualityOptions = [
  { level: 1, label: 'Ligera', tiles: 16 },
  { level: 2, label: 'Estándar', tiles: 64 },
  { level: 3, label: 'Alta', tiles: 256 },
  { level: 4, label: 'Muy alta', tiles: 1024 },
  { level: 5, label: 'Máxima', tiles: 2048 },
]

function Icon({ name }) {
  const paths = {
    reset: <><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></>,
    zoomIn: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5M10.8 7.8v6m-3-3h6" /></>,
    zoomOut: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5m-12.7-6.7h6" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    pause: <><path d="M8 5h3v14H8zM15 5h3v14h-3z" /></>,
    orbit: <><ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-30 12 12)" /><circle cx="12" cy="12" r="2" /><circle cx="20" cy="5" r="1" /></>,
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function App() {
  const viewerRef = useRef(null)
  const [autoRotate, setAutoRotate] = useState(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [progress, setProgress] = useState(initialProgress)
  const [error, setError] = useState('')
  const [qualityLevel, setQualityLevel] = useState(2)
  const [isReady, setIsReady] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [latitudeInput, setLatitudeInput] = useState('0')
  const [longitudeInput, setLongitudeInput] = useState('0')
  const [selectionEnabled, setSelectionEnabled] = useState(false)
  const [surfacePoint, setSurfacePoint] = useState(null)
  const [surfaceInfo, setSurfaceInfo] = useState(null)
  const surfaceMode = Boolean(surfacePoint)

  // Mientras el usuario está en el globo con un punto marcado, se precarga en segundo plano lo que la
  // vista de superficie necesitará (código de Cesium, capas de imagen, LOLA y teselas del punto).
  useEffect(() => {
    if (!selectedPoint || !isReady || surfaceMode) return undefined
    let cancelled = false
    let cancelPrefetch
    const timer = window.setTimeout(() => {
      import('./surface/prefetch.js')
        .then(({ prefetchSurface }) => {
          if (!cancelled) cancelPrefetch = prefetchSurface(selectedPoint)
        })
        .catch(() => { /* la precarga es oportunista */ })
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      cancelPrefetch?.()
    }
  }, [selectedPoint, isReady, surfaceMode])

  const handleProgress = useCallback((layer, value) => {
    setProgress((current) => ({ ...current, [layer]: value }))
  }, [])

  const handleError = useCallback((message) => {
    setError(message)
  }, [])

  const handleReady = useCallback(() => {
    setIsReady(true)
  }, [])

  const handlePointSelected = useCallback((point) => {
    const latitude = Number(point.latitude.toFixed(4))
    const longitude = Number(point.longitude.toFixed(4))
    setSelectedPoint({ latitude, longitude })
    setLatitudeInput(String(latitude))
    setLongitudeInput(String(longitude))
    setSelectionEnabled(false)
  }, [])

  const handleCoordinateSubmit = (event) => {
    event.preventDefault()
    const latitude = Number(latitudeInput)
    const longitude = Number(longitudeInput)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    setSelectedPoint({ latitude, longitude })
    setSelectionEnabled(false)
  }

  const togglePointSelection = () => {
    const nextSelectionState = !selectionEnabled
    setSelectionEnabled(nextSelectionState)
    if (nextSelectionState) {
      window.requestAnimationFrame(() => {
        document.querySelector('.globe-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }

  const handleExploreSurface = () => {
    if (!selectedPoint) return
    setAutoRotate(false)
    viewerRef.current?.setSuspended(true)
    setSurfaceInfo(null)
    setSurfacePoint(selectedPoint)
    window.requestAnimationFrame(() => {
      document.querySelector('.globe-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handleReturnToGlobe = () => {
    setSurfacePoint(null)
    setSurfaceInfo(null)
    viewerRef.current?.setSuspended(false)
  }

  const visibleProgress = progress
  const totalTiles = visibleProgress.imagery.total + visibleProgress.elevation.total
  const loadedTiles = visibleProgress.imagery.loaded + visibleProgress.elevation.loaded
  const hasMissingTiles = progress.imagery.failed + progress.elevation.failed > 0
  const selectedQuality = qualityOptions.find((option) => option.level === qualityLevel)

  const changeQuality = (level) => {
    if (level === qualityLevel || surfaceMode) return
    setProgress(initialProgress)
    setError('')
    setIsReady(false)
    setQualityLevel(level)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="https://trek.nasa.gov/" target="_blank" rel="noreferrer" aria-label="NASA Trek, abrir en una nueva pestaña">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-copy">
            <strong>LUNAR ATLAS</strong>
            <span>NASA TREK / MOON</span>
          </span>
        </a>
        <div className="topbar-meta">
          <span className="live-indicator" aria-hidden="true" />
          <span>DATOS WMTS</span>
          <span className="topbar-divider" />
          <span className="topbar-source">{surfaceMode ? 'CESIUM · NASA' : 'LOLA · WAC'}</span>
        </div>
      </header>

      <div className="workspace">
        <section className="viewer" aria-label="Globo lunar interactivo">
          <div className="viewer-topline">
            <div className="eyebrow"><span>01</span> EXPLORADOR PLANETARIO</div>
            <div className="projection-tag">
              <span className="projection-dot" />
              {surfaceMode ? 'VISTA DE SUPERFICIE · CESIUM' : 'EQUIRECTANGULAR · 360°'}
            </div>
          </div>

          <div className={`globe-stage${selectionEnabled ? ' is-selecting-point' : ''}`}>
            <div className="stage-grain" aria-hidden="true" />
            <Suspense fallback={<div className="scene-host" />}>
              <MoonScene
                viewerRef={viewerRef}
                autoRotate={autoRotate}
                qualityLevel={qualityLevel}
                selectionEnabled={selectionEnabled}
                selectedPoint={selectedPoint}
                onPointSelected={handlePointSelected}
                onProgress={handleProgress}
                onError={handleError}
                onReady={handleReady}
              />
            </Suspense>
            {surfacePoint && (
              <SurfaceExplorer
                key={`${surfacePoint.latitude}/${surfacePoint.longitude}`}
                point={surfacePoint}
                closeLabel="VOLVER AL GLOBO"
                onClose={handleReturnToGlobe}
                onInfo={setSurfaceInfo}
              />
            )}
            {!surfaceMode && <div className="globe-caption">
              <span className="caption-kicker">CUERPO CELESTE</span>
              <strong>La Luna</strong>
              <span>Radio medio <b>1.737,4 km</b></span>
            </div>}
            {selectionEnabled && !surfaceMode && (
              <div className="selection-prompt" role="status">
                Haz clic en el globo para marcar el punto
              </div>
            )}
            {error && (
              <div className="scene-error" role="alert">
                <strong>No se pudo cargar el globo</strong>
                <span>{error}</span>
                <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
              </div>
            )}

            {!error && !isReady && (
              <div className="loading-card" role="status" aria-live="polite">
                <span className="loading-spinner" aria-hidden="true" />
                <span>
                  <strong>Conectando con NASA Trek</strong>
                  <small>{totalTiles ? `${loadedTiles} de ${totalTiles} teselas` : 'Leyendo capacidades WMTS…'}</small>
                </span>
              </div>
            )}

            {!surfaceMode && <div className="viewer-controls" aria-label="Controles del globo">
              <button type="button" aria-label="Alejar globo" title="Alejar" onClick={() => viewerRef.current?.zoomOut()}>
                <Icon name="zoomOut" />
              </button>
              <button type="button" aria-label="Acercar globo" title="Acercar" onClick={() => viewerRef.current?.zoomIn()}>
                <Icon name="zoomIn" />
              </button>
              <span className="control-separator" />
              <button type="button" aria-label="Restablecer vista" title="Restablecer vista" onClick={() => viewerRef.current?.resetView()}>
                <Icon name="reset" />
              </button>
              <button
                type="button"
                className={autoRotate ? 'is-selected' : ''}
                aria-label={autoRotate ? 'Pausar rotación automática' : 'Activar rotación automática'}
                aria-pressed={autoRotate}
                title={autoRotate ? 'Pausar rotación' : 'Activar rotación'}
                onClick={() => setAutoRotate((current) => !current)}
              >
                <Icon name={autoRotate ? 'pause' : 'play'} />
              </button>
            </div>}
          </div>

          <div className="viewer-footer">
            <div className="footer-status">
              <span className={`status-dot ${isReady && !hasMissingTiles ? 'status-ready' : ''}`} />
              <span>
                {surfaceMode
                  ? 'VISTA DE SUPERFICIE'
                  : selectionEnabled
                    ? 'SELECCIONA UN PUNTO'
                    : error
                      ? 'ERROR DE CONEXIÓN'
                      : !isReady
                        ? 'CARGANDO CAPAS'
                        : hasMissingTiles
                          ? 'COBERTURA PARCIAL'
                          : qualityLevel >= 4
                            ? 'DETALLE BAJO DEMANDA'
                            : 'CAPAS CARGADAS'}
              </span>
            </div>
            <div className="footer-coordinates">
              <span>ESCALA DE ALTURA <b>VISUAL</b></span>
              <span className="footer-divider" />
              <span>
                {selectedPoint
                  ? `LAT ${selectedPoint.latitude.toFixed(3)}° · LON ${selectedPoint.longitude.toFixed(3)}°`
                  : <>FUENTE <b>NASA TREK WMTS</b></>}
              </span>
            </div>
          </div>
        </section>

        <aside className="sidebar">
          <div className="sidebar-heading">
            <span className="eyebrow"><span>02</span> FICHA DEL CUERPO</span>
            <span className="body-code">MOON / 301</span>
          </div>
          <h1>Topografía<br /><span>lunar</span></h1>
          <p className="intro-copy">Un globo interactivo construido con mosaicos de imagen y elevación de NASA Trek.</p>

          <div className="data-divider" />

          <section className="layer-section" aria-labelledby="layers-title">
            <div className="section-title-row">
              <h2 id="layers-title">Capas activas</h2>
              <span className="layer-count">02</span>
            </div>
            <div className="layer-card">
              <span className="layer-swatch swatch-imagery" aria-hidden="true" />
              <div className="layer-info">
                <strong>Mosaico de imagen</strong>
                <span>
                  {surfaceMode
                    ? `Superficie · ${surfaceInfo?.imagery.at(-1)?.title || 'buscando mosaicos…'} (Cesium)`
                    : 'LRO WAC · 303 px/grado'}
                </span>
              </div>
              <span className="layer-check" aria-label="Activa">✓</span>
            </div>
            <div className="layer-card">
              <span className="layer-swatch swatch-elevation" aria-hidden="true" />
              <div className="layer-info">
                <strong>Modelo de elevación</strong>
                <span>
                  {surfaceMode
                    ? `Superficie · ${surfaceInfo?.dem.title || 'descargando LOLA…'} (Cesium)`
                    : 'LOLA DEM · 128 px/grado'}
                </span>
              </div>
              <span className="layer-check" aria-label="Activa">✓</span>
            </div>
          </section>

          <section className="point-section" aria-labelledby="point-title">
            <div className="section-title-row">
              <h2 id="point-title">Explorar un punto</h2>
              <span className="layer-count">CESIUM</span>
            </div>
            <p className="point-helper">Marca una ubicación en el globo o escribe sus coordenadas lunares.</p>
            <button
              className={`point-pick-button${selectionEnabled ? ' is-active' : ''}`}
              type="button"
              aria-pressed={selectionEnabled}
              disabled={!isReady || surfaceMode}
              onClick={togglePointSelection}
            >
              {selectionEnabled ? 'CANCELAR SELECCIÓN' : 'SELECCIONAR EN EL GLOBO'}
            </button>
            <form className="coordinate-form" onSubmit={handleCoordinateSubmit}>
              <label>
                Latitud
                <input
                  type="number"
                  name="latitude"
                  min="-90"
                  max="90"
                  step="any"
                  required
                  value={latitudeInput}
                  disabled={surfaceMode}
                  onChange={(event) => setLatitudeInput(event.target.value)}
                />
              </label>
              <label>
                Longitud
                <input
                  type="number"
                  name="longitude"
                  min="-180"
                  max="180"
                  step="any"
                  required
                  value={longitudeInput}
                  disabled={surfaceMode}
                  onChange={(event) => setLongitudeInput(event.target.value)}
                />
              </label>
              <button type="submit" disabled={surfaceMode}>MARCAR COORDENADAS</button>
            </form>
            <div className="nac-sites" aria-label="Zonas con imagen NAC de alta resolución">
              <span>Zonas con imagen NAC ~0,5 m</span>
              <div>
                {nacSites.map((site) => (
                  <button
                    type="button"
                    key={site.name}
                    disabled={surfaceMode}
                    onClick={() => {
                      setSelectedPoint({ latitude: site.latitude, longitude: site.longitude })
                      setLatitudeInput(String(site.latitude))
                      setLongitudeInput(String(site.longitude))
                      setSelectionEnabled(false)
                    }}
                  >
                    {site.name}
                  </button>
                ))}
              </div>
            </div>
            <p className="selected-point" role="status">
              {selectedPoint
                ? `Punto: ${selectedPoint.latitude.toFixed(4)}° lat · ${selectedPoint.longitude.toFixed(4)}° lon`
                : 'Sin punto seleccionado'}
            </p>
            <button
              className="surface-launch-button"
              type="button"
              disabled={!selectedPoint || !isReady || surfaceMode}
              onClick={handleExploreSurface}
            >
              {surfaceMode ? 'EN PRIMERA PERSONA' : 'EXPLORAR EN PRIMERA PERSONA'}
            </button>
            <p className="point-resolution-note">
              La vista de superficie usa CesiumJS con el elipsoide lunar: carga solo las teselas de imagen de NASA Trek de mayor resolución que cubren el punto (según el zoom de la cámara) y el relieve real LOLA de 16 bits del PDS de la NASA.
            </p>
          </section>

          <section className="quality-section" aria-labelledby="quality-title">
            <div className="section-title-row">
              <h2 id="quality-title">Calidad del modelo</h2>
              <span className="coverage-value">{selectedQuality.tiles} TESELAS</span>
            </div>
            <div className="quality-options" aria-label="Elige la cantidad de teselas">
              {qualityOptions.map((option) => (
                <button
                  type="button"
                  key={option.level}
                  className={qualityLevel === option.level ? 'quality-option is-active' : 'quality-option'}
                  aria-pressed={qualityLevel === option.level}
                  aria-label={`${option.label}: ${option.tiles} teselas entre las dos capas`}
                  disabled={surfaceMode}
                  onClick={() => changeQuality(option.level)}
                >
                  <span>{option.label}</span>
                  <small>{option.tiles}</small>
                </button>
              ))}
            </div>
            <p className="quality-hint">
              {qualityLevel >= 4
                ? `El mosaico base se completa con detalle de la zona visible al rotar. Presupuesto máximo: ${selectedQuality.tiles} solicitudes entre ambas capas; el progreso cuenta solo las teselas planificadas.`
                : 'Más teselas aumentan el detalle y el tiempo de descarga.'}
              {' '}Este selector solo afecta al globo; la vista de superficie usa Cesium con su propio nivel de detalle.
            </p>
          </section>

          <section className="coverage-section" aria-label="Progreso de carga">
            <div className="section-title-row">
              <h2>Descarga de teselas</h2>
              <span className="coverage-value">{totalTiles ? `${Math.round((loadedTiles / totalTiles) * 100)}%` : '—'}</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Teselas cargadas"
              aria-valuemin="0"
              aria-valuemax={totalTiles || 100}
              aria-valuenow={loadedTiles}
            >
              <span style={{ width: `${totalTiles ? (loadedTiles / totalTiles) * 100 : 0}%` }} />
            </div>
            <div className="tile-counts">
              <span>Imagen <b>{visibleProgress.imagery.loaded}/{visibleProgress.imagery.total || '—'}</b></span>
              <span>Relieve <b>{visibleProgress.elevation.loaded}/{visibleProgress.elevation.total || '—'}</b></span>
            </div>
            <p className="quality-hint">
              {surfaceMode
                ? 'Descarga del globo.'
                : 'El contador refleja las solicitudes realmente planificadas; el presupuesto es un límite, no una meta de descarga.'}
            </p>
          </section>

          <section className="model-note" aria-labelledby="model-note-title">
            <span className="note-icon" aria-hidden="true"><Icon name="orbit" /></span>
            <div>
              <h2 id="model-note-title">Sobre el relieve</h2>
              <p>El terreno se construye con el DEM real de NASA Trek. Si el catálogo no publica su rango vertical, se representa como relieve relativo, no en metros calibrados; los PNG de 8 bits no sirven para mediciones científicas.</p>
            </div>
          </section>

          <div className="sidebar-bottom">
            <a href="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon" target="_blank" rel="noreferrer">
              DOCUMENTACIÓN DE LA API <span aria-hidden="true">↗</span>
            </a>
            <span>OGC WMTS · PROYECCIÓN EQ</span>
          </div>
        </aside>
      </div>

      <footer className="page-footer">
        <span>NASA TREK MAP SERVICES</span>
        <span>INTERACTÚA: ARRASTRA PARA ROTAR · RUEDA PARA ACERCAR</span>
      </footer>
    </main>
  )
}

export default App
