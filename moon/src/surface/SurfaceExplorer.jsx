import useSurfaceExplorer from './useSurfaceExplorer.jsx'
import './SurfaceExplorer.css'

// Velocidad del cielo estrellado respecto al tiempo real (la Luna da una vuelta cada 27,32 días).
const SKY_SPEEDS = [
  [1, 'Tiempo real'],
  [60, '1 minuto por segundo'],
  [600, '10 minutos por segundo'],
  [3600, '1 hora por segundo'],
  [21600, '6 horas por segundo'],
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
export default function SurfaceExplorer({ point, title, closeLabel = 'VOLVER', onClose, onInfo }) {
  const surface = useSurfaceExplorer(point, { onInfo })
  const { info, status, error, loading, tourActive, position, bestImagery: best } = surface

  return (
    <div className="moon-sx">
      {surface.view}

      {loading && (
        <div className="moon-sx-card" role="status" aria-live="polite">
          <span className="moon-sx-spinner" aria-hidden="true" />
          <span>
            <strong>Preparando vista de superficie</strong>
            <small>
              {status.phase === 'catalog' || status.phase === 'idle'
                ? 'Buscando mosaicos de imagen de NASA Trek…'
                : status.phase === 'terrain'
                  ? `Descargando elevación LOLA (16 bits) · ${status.terrain.loaded}/${status.terrain.total}`
                  : 'Iniciando visor Cesium…'}
            </small>
          </span>
        </div>
      )}

      {error && (
        <div className="moon-sx-card moon-sx-error" role="alert">
          <span>
            <strong>No se pudo cargar la superficie</strong>
            <small>{error}</small>
          </span>
          <button type="button" onClick={onClose}>{closeLabel}</button>
        </div>
      )}

      {info && (
        <div className="moon-sx-hud" aria-label="Controles de primera persona">
          <div className="moon-sx-hud-info">
            <span className="moon-sx-kicker">EXPLORACIÓN LUNAR · CESIUM</span>
            {title && <b className="moon-sx-title">{title}</b>}
            <strong>{position.latitude.toFixed(4)}° · {position.longitude.toFixed(4)}°</strong>
            <span>
              Imagen: {best?.title || 'Mosaico de NASA Trek'} · hasta ~{best?.resolutionMetersPerPixel?.toFixed(2)} m/píxel
              {' '}· z{best?.maximumLevel}
            </span>
            <span>
              Terreno: {info.dem.title} · ~{info.dem.resolutionMetersPerPixel.toFixed(1)} m/píxel
            </span>
          </div>

          <div className="moon-sx-actions">
            <button type="button" onClick={surface.toggleTour}>
              {tourActive ? 'PAUSAR RECORRIDO' : 'INICIAR RECORRIDO'}
            </button>
            <button type="button" onClick={onClose}>{closeLabel}</button>
          </div>

          <details className="moon-sx-settings">
            <summary>Ajustes de imagen y relieve</summary>
            <span className="moon-sx-note">
              Capas combinadas: {info.imagery.length} · rugosidad LOLA local {info.detail.roughness.toFixed(2)} m a 30 m
              {info.detail.sun && (
                <>
                  {' '}· sol {info.detail.sun.estimated ? 'estimado' : 'supuesto'} (az {info.detail.sun.azimuthDegrees.toFixed(0)}° / el {info.detail.sun.elevationDegrees.toFixed(0)}°)
                </>
              )}
            </span>

            <label className="moon-sx-slider">
              <span>Detalle calibrado (sintético) <b>{surface.detail === 0 ? 'APAGADO' : `${surface.detail.toFixed(1)}×`}</b></span>
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
              <span>Contraste de la imagen <b>{surface.contrast.toFixed(1)}×</b></span>
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
              <span>Cielo estrellado: giro</span>
              <select value={surface.skyTimeScale} onChange={(event) => surface.changeSkyTimeScale(Number(event.target.value))}>
                {SKY_SPEEDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            {info.baseOptions.length > 1 && (
              <label className="moon-sx-slider">
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

            <label className="moon-sx-slider">
              <span>Exageración vertical <b>{surface.exaggeration.toFixed(1)}×</b></span>
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

          <small className="moon-sx-help">WASD para caminar · Shift corre · Arrastra para mirar · Esc para pausar</small>
        </div>
      )}

      {info && (
        <div className="moon-sx-walk-pad" aria-label="Controles para caminar">
          <WalkButton direction="forward" label="Caminar hacia adelante" symbol="↑" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="left" label="Caminar hacia la izquierda" symbol="←" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="backward" label="Caminar hacia atrás" symbol="↓" disabled={!tourActive} onWalk={surface.walk} />
          <WalkButton direction="right" label="Caminar hacia la derecha" symbol="→" disabled={!tourActive} onWalk={surface.walk} />
        </div>
      )}
    </div>
  )
}
