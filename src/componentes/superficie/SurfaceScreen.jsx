import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Footprints, Home, PanelLeftClose, PanelLeftOpen, Pause, Rocket, X } from 'lucide-react'
import OddityLogo from '../compartidos/OddityLogo.jsx'
import useSurfaceExplorer from '../../../moon/src/surface/useSurfaceExplorer.jsx'
import { formatLatitude, formatLongitude } from './coordinates.js'
import '../../estilos/superficie/SurfaceScreen.css'

// Nave de la demostración de aterrizaje (public/modelos).
const LANDING_MODEL_URL = '/modelos/Saturn%20V.glb'

function WalkButton({ direction, label, symbol, disabled, onWalk }) {
  const startWalking = (event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onWalk(direction, true)
  }
  const stopWalking = () => onWalk(direction, false)
  const handleClick = (event) => {
    if (event.detail !== 0 || disabled) return
    onWalk(direction, true)
    window.setTimeout(stopWalking, 250)
  }

  return (
    <button
      className={`surface-walk surface-walk-${direction}`}
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={startWalking}
      onPointerUp={stopWalking}
      onPointerCancel={stopWalking}
      onLostPointerCapture={stopWalking}
      onClick={handleClick}
    >
      {symbol}
    </button>
  )
}

// Velocidad del cielo estrellado respecto al tiempo real (la Luna da una vuelta cada 27,32 días).
const SKY_SPEEDS = [
  [1, 'Tiempo real'],
  [60, '1 minuto por segundo'],
  [600, '10 minutos por segundo'],
  [3600, '1 hora por segundo'],
  [21600, '6 horas por segundo'],
]

function Slider({ label, value, display, ...inputProps }) {
  return (
    <label className="surface-slider">
      <span>{label} <b>{display}</b></span>
      <input type="range" value={value} {...inputProps} />
    </label>
  )
}

/**
 * Primera persona sobre el sitio elegido, con el diseño de Oddity: visor Cesium (datos de NASA Trek y
 * LOLA) a pantalla completa y un panel lateral como el del resto de la aplicación.
 *
 * `target.latitude` / `target.longitude` se usan sin modificar: el recorrido empieza exactamente ahí.
 *
 * @param {{mission: object, latitude: number, longitude: number, source: 'mission'|'custom'}} target
 */
export default function SurfaceScreen({ target, onClose, onHome }) {
  const { mission } = target
  const point = { latitude: target.latitude, longitude: target.longitude }
  const surface = useSurfaceExplorer(point, { landingModelUrl: LANDING_MODEL_URL })
  const [panelOpen, setPanelOpen] = useState(true)
  const { info, status, error, loading, tourActive, position, bestImagery: best, demoState } = surface
  const demoBusy = demoState === 'loading' || demoState === 'descending'

  const loadingText = status.phase === 'terrain'
    ? `Relieve LOLA de 16 bits · ${status.terrain.loaded}/${status.terrain.total}`
    : status.phase === 'scene'
      ? 'Iniciando visor…'
      : 'Buscando mosaicos de imagen de NASA Trek…'

  return (
    <section className="surface-screen" aria-label={`Primera persona en ${mission.name}`}>
      <div className="surface-view">{surface.view}</div>
      <div className="surface-vignette" aria-hidden="true" />

      <div className={`surface-brand ${panelOpen ? '' : 'is-panel-closed'}`} aria-hidden="true">
        <OddityLogo />
      </div>

      <motion.aside
        className="side-panel surface-panel"
        initial={{ x: '-105%', opacity: 0.6 }}
        animate={{ x: panelOpen ? 0 : '-105%', opacity: panelOpen ? 1 : 0.6 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={!panelOpen}
      >
        <div className="panel-top-actions">
          <button className="text-button" onClick={onClose}><ArrowLeft size={15} /> Regresar</button>
          <button className="icon-button" onClick={() => setPanelOpen(false)} aria-label="Ocultar panel">
            <PanelLeftClose size={16} />
          </button>
          <button className="icon-button" onClick={onHome} aria-label="Regresar al inicio"><Home size={16} /></button>
        </div>

        <div className="surface-content">
          <span className="section-label">Explorador lunar <i /></span>
          <h2>
            {mission.name} <em>— {mission.site}</em>
          </h2>
          <p className="surface-intro">
            Camina sobre el terreno real del sitio con imágenes de NASA Trek y relieve LOLA.
            {target.source === 'mission'
              ? ' El recorrido empieza en las coordenadas históricas de la misión.'
              : ' El recorrido empieza en las coordenadas que elegiste para esta misión.'}
          </p>

          <div className="surface-coords" aria-label="Coordenadas">
            <div>
              <small>Latitud</small>
              <strong>{formatLatitude(position.latitude)}</strong>
            </div>
            <div>
              <small>Longitud</small>
              <strong>{formatLongitude(position.longitude)}</strong>
            </div>
            <p>
              {target.source === 'mission' ? 'Sitio de alunizaje' : 'Punto elegido'}:
              {' '}{formatLatitude(point.latitude)} · {formatLongitude(point.longitude)}
            </p>
          </div>

          {loading && (
            <div className="surface-status" role="status" aria-live="polite">
              <span className="surface-spinner" aria-hidden="true" />
              <span>
                <strong>Preparando superficie</strong>
                <small>{loadingText}</small>
              </span>
            </div>
          )}

          {error && (
            <div className="surface-status is-error" role="alert">
              <span>
                <strong>No se pudo cargar la superficie</strong>
                <small>{error}</small>
              </span>
            </div>
          )}

          {info && (
            <>
              <button className="primary-button surface-tour" onClick={surface.toggleTour}>
                {tourActive ? 'Pausar recorrido' : 'Iniciar recorrido'}
                {tourActive ? <Pause size={17} /> : <Footprints size={17} />}
              </button>

              <button
                className="primary-button surface-demo"
                onClick={surface.startLandingDemo}
                disabled={demoBusy}
              >
                {demoState === 'loading' ? 'Cargando nave…'
                  : demoState === 'descending' ? 'Aterrizando…'
                    : demoState === 'landed' ? 'Repetir demostración'
                      : 'Demostración de aterrizaje'}
                <Rocket size={17} />
              </button>
              {demoState !== 'idle' && (
                <button className="text-button surface-demo-remove" onClick={surface.stopLandingDemo}>
                  <X size={15} /> {demoBusy ? 'Cancelar' : 'Retirar nave'}
                </button>
              )}

              <section className="surface-section">
                <span className="section-label">Datos de NASA <i /></span>
                <dl className="surface-data">
                  <div>
                    <dt>Imagen</dt>
                    <dd>
                      {best?.title || 'Mosaico de NASA Trek'}
                      <small>
                        hasta ~{best?.resolutionMetersPerPixel?.toFixed(2)} m/píxel · {info.imagery.length} capas combinadas
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>Terreno</dt>
                    <dd>
                      {info.dem.title}
                      <small>~{info.dem.resolutionMetersPerPixel.toFixed(1)} m/píxel · alturas de 16 bits</small>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="surface-section">
                <span className="section-label">Ajustes de imagen <i /></span>
                <Slider
                  label="Contraste"
                  display={`${surface.contrast.toFixed(1)}×`}
                  min="0.6"
                  max="2.6"
                  step="0.1"
                  value={surface.contrast}
                  onChange={(event) => surface.changeContrast(Number(event.target.value))}
                />
                <Slider
                  label="Exageración vertical"
                  display={`${surface.exaggeration.toFixed(1)}×`}
                  min="1"
                  max="5"
                  step="0.1"
                  value={surface.exaggeration}
                  onChange={(event) => surface.changeExaggeration(Number(event.target.value))}
                />
                <Slider
                  label="Detalle sintético calibrado"
                  display={surface.detail === 0 ? 'apagado' : `${surface.detail.toFixed(1)}×`}
                  min="0"
                  max="2"
                  step="0.1"
                  value={surface.detail}
                  onChange={(event) => surface.changeDetail(Number(event.target.value))}
                />
                <p className="surface-note">
                  El detalle sintético extiende el relieve por debajo de la resolución de los datos,
                  calibrado con la rugosidad real de LOLA de la zona (
                  {info.detail.roughness.toFixed(2)} m a 30 m). Ponlo en «apagado» para ver solo datos de la NASA.
                </p>
                <label className="surface-slider">
                  <span>Cielo estrellado: giro</span>
                  <select value={surface.skyTimeScale} onChange={(event) => surface.changeSkyTimeScale(Number(event.target.value))}>
                    {SKY_SPEEDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <p className="surface-note">
                  Estrellas reales (catálogo Yale Bright Star, hasta magnitud 6) con el color de cada una y la
                  orientación real de la Luna: sin atmósfera no titilan y el cielo gira una vuelta cada 27,3 días.
                  El giro está acelerado para que se note; solo mueve el cielo, no la luz del terreno.
                </p>
                {info.baseOptions.length > 1 && (
                  <label className="surface-slider">
                    <span>Imagen base</span>
                    <select value={info.baseId} onChange={(event) => surface.changeBaseImagery(event.target.value)}>
                      {info.baseOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.id} · {option.resolutionMetersPerPixel.toFixed(1)} m/px
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>

              <p className="surface-keys">
                <kbd>W A S D</kbd> caminar · <kbd>Shift</kbd> correr · arrastra para mirar · <kbd>Esc</kbd> pausar
              </p>
            </>
          )}
        </div>
      </motion.aside>

      {!panelOpen && (
        <button
          className="icon-button surface-panel-toggle"
          onClick={() => setPanelOpen(true)}
          aria-label="Mostrar panel"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {loading && (
        <div className={`surface-loading ${panelOpen ? 'has-panel' : ''}`} role="status" aria-live="polite">
          <span className="surface-spinner" aria-hidden="true" />
          <span>CARGANDO SUPERFICIE · {mission.name.toUpperCase()}</span>
        </div>
      )}

      {info && (
        <div className="surface-walk-pad" aria-label="Controles para caminar">
          <WalkButton direction="forward" label="Caminar hacia adelante" symbol="↑" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="left" label="Caminar hacia la izquierda" symbol="←" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="backward" label="Caminar hacia atrás" symbol="↓" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="right" label="Caminar hacia la derecha" symbol="→" disabled={!tourActive} onWalk={surface.walk} />
        </div>
      )}
    </section>
  )
}
