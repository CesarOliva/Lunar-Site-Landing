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
  [1, 'Real time'],
  [60, '1 minute per second'],
  [600, '10 minutes per second'],
  [3600, '1 hour per second'],
  [21600, '6 hours per second'],
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
    ? `16-bit LOLA terrain · ${status.terrain.loaded}/${status.terrain.total}`
    : status.phase === 'scene'
      ? 'Starting viewer…'
      : 'Looking up NASA Trek imagery mosaics…'

  return (
    <section className="surface-screen" aria-label={`First person at ${mission.name}`}>
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
          <button className="text-button" onClick={onClose}><ArrowLeft size={15} /> Back</button>
          <button className="icon-button" onClick={() => setPanelOpen(false)} aria-label="Hide panel">
            <PanelLeftClose size={16} />
          </button>
          <button className="icon-button" onClick={onHome} aria-label="Back to home"><Home size={16} /></button>
        </div>

        <div className="surface-content">
          <span className="section-label">Lunar explorer <i /></span>
          <h2>
            {mission.name} <em>— {mission.site}</em>
          </h2>
          <p className="surface-intro">
            Walk on the real terrain of the site with NASA Trek imagery and LOLA relief.
            {target.source === 'mission'
              ? ' The tour starts at the mission\'s historic coordinates.'
              : ' The tour starts at the coordinates you chose for this mission.'}
          </p>

          <div className="surface-coords" aria-label="Coordinates">
            <div>
              <small>Latitude</small>
              <strong>{formatLatitude(position.latitude)}</strong>
            </div>
            <div>
              <small>Longitude</small>
              <strong>{formatLongitude(position.longitude)}</strong>
            </div>
            <p>
              {target.source === 'mission' ? 'Landing site' : 'Chosen point'}:
              {' '}{formatLatitude(point.latitude)} · {formatLongitude(point.longitude)}
            </p>
          </div>

          {loading && (
            <div className="surface-status" role="status" aria-live="polite">
              <span className="surface-spinner" aria-hidden="true" />
              <span>
                <strong>Preparing surface</strong>
                <small>{loadingText}</small>
              </span>
            </div>
          )}

          {error && (
            <div className="surface-status is-error" role="alert">
              <span>
                <strong>The surface could not be loaded</strong>
                <small>{error}</small>
              </span>
            </div>
          )}

          {info && (
            <>
              <button className="primary-button surface-tour" onClick={surface.toggleTour}>
                {tourActive ? 'Pause tour' : 'Start tour'}
                {tourActive ? <Pause size={17} /> : <Footprints size={17} />}
              </button>

              <button
                className="primary-button surface-demo"
                onClick={surface.startLandingDemo}
                disabled={demoBusy}
              >
                {demoState === 'loading' ? 'Loading ship…'
                  : demoState === 'descending' ? 'Landing…'
                    : demoState === 'landed' ? 'Repeat demo'
                      : 'Landing demo'}
                <Rocket size={17} />
              </button>
              {demoState !== 'idle' && (
                <button className="text-button surface-demo-remove" onClick={surface.stopLandingDemo}>
                  <X size={15} /> {demoBusy ? 'Cancel' : 'Remove ship'}
                </button>
              )}

              <section className="surface-section">
                <span className="section-label">NASA data <i /></span>
                <dl className="surface-data">
                  <div>
                    <dt>Imagery</dt>
                    <dd>
                      {best?.title || 'NASA Trek mosaic'}
                      <small>
                        up to ~{best?.resolutionMetersPerPixel?.toFixed(2)} m/pixel · {info.imagery.length} combined layers
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>Terrain</dt>
                    <dd>
                      {info.dem.title}
                      <small>~{info.dem.resolutionMetersPerPixel.toFixed(1)} m/pixel · 16-bit heights</small>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="surface-section">
                <span className="section-label">Image settings <i /></span>
                <Slider
                  label="Contrast"
                  display={`${surface.contrast.toFixed(1)}×`}
                  min="0.6"
                  max="2.6"
                  step="0.1"
                  value={surface.contrast}
                  onChange={(event) => surface.changeContrast(Number(event.target.value))}
                />
                <Slider
                  label="Vertical exaggeration"
                  display={`${surface.exaggeration.toFixed(1)}×`}
                  min="1"
                  max="5"
                  step="0.1"
                  value={surface.exaggeration}
                  onChange={(event) => surface.changeExaggeration(Number(event.target.value))}
                />
                <Slider
                  label="Calibrated synthetic detail"
                  display={surface.detail === 0 ? 'off' : `${surface.detail.toFixed(1)}×`}
                  min="0"
                  max="2"
                  step="0.1"
                  value={surface.detail}
                  onChange={(event) => surface.changeDetail(Number(event.target.value))}
                />
                <p className="surface-note">
                  Synthetic detail extends the relief below the resolution of the data,
                  calibrated with the real LOLA roughness of the area (
                  {info.detail.roughness.toFixed(2)} m at 30 m). Set it to "off" to see NASA data only.
                </p>
                <label className="surface-slider">
                  <span>Starry sky: rotation</span>
                  <select value={surface.skyTimeScale} onChange={(event) => surface.changeSkyTimeScale(Number(event.target.value))}>
                    {SKY_SPEEDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <p className="surface-note">
                  Real stars (Yale Bright Star catalog, down to magnitude 6) with each star's color and the
                  real orientation of the Moon: without an atmosphere they do not twinkle and the sky turns once every 27.3 days.
                  The rotation is accelerated so it is noticeable; it only moves the sky, not the terrain lighting.
                </p>
                {info.baseOptions.length > 1 && (
                  <label className="surface-slider">
                    <span>Base imagery</span>
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
                <kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · drag to look · <kbd>Esc</kbd> pause
              </p>
            </>
          )}
        </div>
      </motion.aside>

      {!panelOpen && (
        <button
          className="icon-button surface-panel-toggle"
          onClick={() => setPanelOpen(true)}
          aria-label="Show panel"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {loading && (
        <div className={`surface-loading ${panelOpen ? 'has-panel' : ''}`} role="status" aria-live="polite">
          <span className="surface-spinner" aria-hidden="true" />
          <span>LOADING SURFACE · {mission.name.toUpperCase()}</span>
        </div>
      )}

      {info && (
        <div className="surface-walk-pad" aria-label="Walking controls">
          <WalkButton direction="forward" label="Walk forward" symbol="↑" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="left" label="Walk left" symbol="←" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="backward" label="Walk backward" symbol="↓" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="right" label="Walk right" symbol="→" disabled={!tourActive} onWalk={surface.walk} />
        </div>
      )}
    </section>
  )
}
