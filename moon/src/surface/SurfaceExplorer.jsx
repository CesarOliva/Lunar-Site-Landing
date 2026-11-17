import useSurfaceExplorer from './useSurfaceExplorer.jsx'
import './SurfaceExplorer.css'

// Velocidad del cielo estrellado respecto al tiempo real (la Luna da una vuelta cada 27,32 días).
const SKY_SPEEDS = [
  [1, 'Real time'],
  [60, '1 minute per second'],
  [600, '10 minutes per second'],
  [3600, '1 hour per second'],
  [21600, '6 hours per second'],
]

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
      className={`moon-sx-walk moon-sx-walk-${direction}`}
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

/**
 * Interfaz de la vista de primera persona del explorador MOON (tema oscuro propio). La lógica está en
 * `useSurfaceExplorer`; otras aplicaciones (p. ej. Landing) la reutilizan con su propio diseño.
 *
 * Ocupa todo su contenedor (que debe tener `position: relative` o ser una posición de referencia).
 *
 * @param {{latitude:number, longitude:number}} point punto lunar; cambiar de punto requiere `key` nuevo.
 * @param {string} [title] nombre del lugar que se muestra en el HUD.
 * @param {() => void} onClose se llama al pulsar volver (o tras un error).
 * @param {(info: object|null) => void} [onInfo] recibe las capas de imagen/relieve activas.
 */
export default function SurfaceExplorer({ point, title, closeLabel = 'BACK', onClose, onInfo }) {
  const surface = useSurfaceExplorer(point, { onInfo })
  const { info, status, error, loading, tourActive, position, bestImagery: best } = surface

  return (
    <div className="moon-sx">
      {surface.view}

      {loading && (
        <div className="moon-sx-card" role="status" aria-live="polite">
          <span className="moon-sx-spinner" aria-hidden="true" />
          <span>
            <strong>Preparing surface view</strong>
            <small>
              {status.phase === 'catalog' || status.phase === 'idle'
                ? 'Looking up NASA Trek imagery mosaics…'
                : status.phase === 'terrain'
                  ? `Downloading LOLA elevation (16-bit) · ${status.terrain.loaded}/${status.terrain.total}`
                  : 'Starting Cesium viewer…'}
            </small>
          </span>
        </div>
      )}

      {error && (
        <div className="moon-sx-card moon-sx-error" role="alert">
          <span>
            <strong>The surface could not be loaded</strong>
            <small>{error}</small>
          </span>
          <button type="button" onClick={onClose}>{closeLabel}</button>
        </div>
      )}

      {info && (
        <div className="moon-sx-hud" aria-label="First-person controls">
          <div className="moon-sx-hud-info">
            <span className="moon-sx-kicker">LUNAR EXPLORATION · CESIUM</span>
            {title && <b className="moon-sx-title">{title}</b>}
            <strong>{position.latitude.toFixed(4)}° · {position.longitude.toFixed(4)}°</strong>
            <span>
              Imagery: {best?.title || 'NASA Trek mosaic'} · up to ~{best?.resolutionMetersPerPixel?.toFixed(2)} m/pixel
              {' '}· z{best?.maximumLevel}
            </span>
            <span>
              Terrain: {info.dem.title} · ~{info.dem.resolutionMetersPerPixel.toFixed(1)} m/pixel
            </span>
          </div>

          <div className="moon-sx-actions">
            <button type="button" onClick={surface.toggleTour}>
              {tourActive ? 'PAUSE TOUR' : 'START TOUR'}
            </button>
            <button type="button" onClick={onClose}>{closeLabel}</button>
          </div>

          <details className="moon-sx-settings">
            <summary>Image and terrain settings</summary>
            <span className="moon-sx-note">
              Combined layers: {info.imagery.length} · local LOLA roughness {info.detail.roughness.toFixed(2)} m at 30 m
              {info.detail.sun && (
                <>
                  {' '}· sun {info.detail.sun.estimated ? 'estimated' : 'assumed'} (az {info.detail.sun.azimuthDegrees.toFixed(0)}° / el {info.detail.sun.elevationDegrees.toFixed(0)}°)
                </>
              )}
            </span>

            <label className="moon-sx-slider">
              <span>Calibrated (synthetic) detail <b>{surface.detail === 0 ? 'OFF' : `${surface.detail.toFixed(1)}×`}</b></span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={surface.detail}
                onChange={(event) => surface.changeDetail(Number(event.target.value))}
              />
            </label>

            <label className="moon-sx-slider">
              <span>Image contrast <b>{surface.contrast.toFixed(1)}×</b></span>
              <input
                type="range"
                min="0.6"
                max="2.6"
                step="0.1"
                value={surface.contrast}
                onChange={(event) => surface.changeContrast(Number(event.target.value))}
              />
            </label>

            <label className="moon-sx-slider">
              <span>Starry sky: rotation</span>
              <select value={surface.skyTimeScale} onChange={(event) => surface.changeSkyTimeScale(Number(event.target.value))}>
                {SKY_SPEEDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            {info.baseOptions.length > 1 && (
              <label className="moon-sx-slider">
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

            <label className="moon-sx-slider">
              <span>Vertical exaggeration <b>{surface.exaggeration.toFixed(1)}×</b></span>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={surface.exaggeration}
                onChange={(event) => surface.changeExaggeration(Number(event.target.value))}
              />
            </label>
          </details>

          <small className="moon-sx-help">WASD to walk · Shift to run · Drag to look · Esc to pause</small>
        </div>
      )}

      {info && (
        <div className="moon-sx-walk-pad" aria-label="Walking controls">
          <WalkButton direction="forward" label="Walk forward" symbol="↑" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="left" label="Walk left" symbol="←" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="backward" label="Walk backward" symbol="↓" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="right" label="Walk right" symbol="→" disabled={!tourActive} onWalk={surface.walk} />
        </div>
      )}
    </div>
  )
}
