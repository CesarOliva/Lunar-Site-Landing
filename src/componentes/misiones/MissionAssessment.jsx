import { useState } from 'react'
import sceneCatalog from '../../../data/apollo_scenes.json'
import '../../estilos/misiones/MissionAssessment.css'

const utcValue = (value) => `${value.length === 16 ? `${value}:00` : value}Z`

async function readApiResponse(response) {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error(response.ok
      ? 'El servicio lunar respondi\u00f3 sin datos. Comprueba que lunar_api.py siga activo e int\u00e9ntalo de nuevo.'
      : `El servicio lunar no devolvi\u00f3 detalles (HTTP ${response.status}). Comprueba que lunar_api.py siga activo.`)
  }

  let result
  try {
    result = JSON.parse(body)
  } catch {
    throw new Error(`El servicio lunar devolvi\u00f3 una respuesta no v\u00e1lida (HTTP ${response.status}). Comprueba que lunar_api.py siga activo.`)
  }

  if (!response.ok) {
    throw new Error(result.error ?? `Error de consulta (${response.status}).`)
  }
  return result
}

function Angle({ label, body }) {
  const visible = body.terrain_visibility === 'visible'
  const blocked = body.terrain_visibility === 'blocked'
  return (
    <div className="mission-assessment-angle">
      <strong>{label}</strong>
      <span>Az. {body.azimuth_deg.toFixed(2)}°</span>
      <span>El. {body.elevation_deg.toFixed(2)}°</span>
      <small className={visible ? 'is-visible' : blocked ? 'is-blocked' : ''}>
        {visible ? 'Visible sobre relieve' : blocked ? 'Oculto por relieve' : 'Relieve indeterminado'}
      </small>
    </div>
  )
}

function MissionAssessment({ mission, onSceneChange }) {
  const historicScene = sceneCatalog.missions[mission.id]
  const [scene, setScene] = useState(null)
  const [latitude, setLatitude] = useState(String(historicScene.site.latitude_deg))
  const [longitude, setLongitude] = useState(String(historicScene.site.longitude_deg))
  const [dateTime, setDateTime] = useState(historicScene.time_utc.slice(0, 19))
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState('')
  const [error, setError] = useState('')
  const [alternatives, setAlternatives] = useState(null)
  const currentScene = scene ?? historicScene
  const assessment = currentScene.landing_assessment
  const assessedLive = scene !== null
  const status = assessment?.status ?? 'indeterminate'
  const statusLabel = assessment?.status_label ?? 'Indeterminado'

  async function evaluateSite(lat = Number(latitude), lon = Number(longitude), time = utcValue(dateTime)) {
    setLoading(true)
    setError('')
    setAlternatives(null)
    try {
      const response = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude_deg: lat, longitude_deg: lon, time_utc: time }),
      })
      const result = await readApiResponse(response)
      setScene(result)
      onSceneChange?.(result)
      setLatitude(String(result.site.latitude_deg))
      setLongitude(String(result.site.longitude_deg))
      setDateTime(result.time_utc.slice(0, 19))
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'No se pudo consultar el servicio lunar local.')
    } finally {
      setLoading(false)
    }
  }

  async function findAlternatives(mode) {
    setSearching(mode)
    setError('')
    setAlternatives(null)
    try {
      const response = await fetch('/api/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          latitude_deg: currentScene.site.latitude_deg,
          longitude_deg: currentScene.site.longitude_deg,
          time_utc: currentScene.time_utc,
        }),
      })
      const result = await readApiResponse(response)
      setAlternatives(result)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'No se pudieron buscar alternativas.')
    } finally {
      setSearching('')
    }
  }

  function chooseLocation(candidate) {
    void evaluateSite(candidate.latitude_deg, candidate.longitude_deg, currentScene.time_utc)
  }

  function chooseDate(candidate) {
    void evaluateSite(currentScene.site.latitude_deg, currentScene.site.longitude_deg, candidate.time_utc)
  }

  return (
    <section className="mission-assessment" aria-labelledby={`assessment-${mission.id}`}>
      <div className="mission-assessment-heading">
        <div>
          <h3 id={`assessment-${mission.id}`}>Condiciones del alunizaje</h3>
          <p>{assessedLive ? 'Consulta con Horizons para el punto y momento elegidos' : `Fecha cálculada · ${currentScene.time_utc.slice(0, 10)} · ${currentScene.time_utc.slice(11, 16)} UT`}</p>
        </div>
        <span className={`mission-assessment-status is-${status}`}>{statusLabel}</span>
      </div>

      {assessment?.coverage === 'available' ? <>
        <p className="mission-assessment-slope">Pendiente máxima <strong>{assessment.max_slope_deg.toFixed(2)}°</strong><span>límite {assessment.slope_limit_deg.toFixed(1)}° · área {assessment.landing_area_diameter_m} m</span></p>
        <div className="mission-assessment-angles">
          <Angle label="Sol" body={currentScene.sun} />
          <Angle label="Tierra" body={currentScene.earth} />
        </div>
        <p className="mission-assessment-source">{`La grilla LOLA tiene celdas de ${assessment.resolution_m} m aprox.; el horizonte busca relieve hasta ${assessment.profile_radius_km} km, cada ${assessment.azimuth_step_deg}\u00b0 de azimut.`}</p>
        {assessment.limitations?.length > 0 && <details className="mission-assessment-limits"><summary>Alcance del cálculo</summary><ul>{assessment.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
      </> : <p className="mission-assessment-reason">{assessment?.reason ?? 'No hay cobertura LOLA suficiente para evaluar este sitio.'}</p>}

      <details className="mission-assessment-query">
        <summary>Evaluar otra fecha o coordenadas</summary>
        <form onSubmit={(event) => { event.preventDefault(); void evaluateSite() }}>
          <label>Latitud (°)<input type="number" min="-90" max="90" step="0.000001" required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label>Longitud · este positivo (°)<input type="number" min="-180" max="180" step="0.000001" required value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
          <label className="mission-assessment-date">Fecha y hora UTC<input type="datetime-local" min="1962-01-20T00:00" step="1" required value={dateTime} onChange={(event) => setDateTime(event.target.value)} /></label>
          <button type="submit" disabled={loading || Boolean(searching)}>{loading ? 'Calculando…' : 'Consultar evaluación'}</button>
        </form>
        {loading && <p className="mission-assessment-message" role="status">Consultando efemérides y perfil topográfico…</p>}
        {error && <p className="mission-assessment-error" role="alert">{error}</p>}
        {assessedLive && status === 'unfavorable' && <div className="mission-alternative-actions">
          <button type="button" disabled={loading || Boolean(searching)} onClick={() => void findAlternatives('location')}>{searching === 'location' ? 'Buscando…' : 'Buscar punto cercano viable'}</button>
          <button type="button" disabled={loading || Boolean(searching)} onClick={() => void findAlternatives('date')}>{searching === 'date' ? 'Buscando…' : 'Buscar otra fecha'}</button>
        </div>}
        {searching && <p className="mission-assessment-message" role="status">{searching === 'location' ? 'Buscando en un radio de 5 km…' : 'Buscando horas dentro de ±7 días…'}</p>}
        {alternatives && <div className="mission-alternatives" aria-live="polite">
          {alternatives.mode === 'location' ? alternatives.candidates.map((candidate) => <button type="button" key={`${candidate.latitude_deg}-${candidate.longitude_deg}`} onClick={() => chooseLocation(candidate)}>
            <strong>{candidate.latitude_deg.toFixed(5)}°, {candidate.longitude_deg.toFixed(5)}°</strong>
            <span>{(candidate.distance_m / 1000).toFixed(1)} km · pendiente {candidate.max_slope_deg.toFixed(2)}°</span>
          </button>) : alternatives.candidates.map((candidate) => <button type="button" key={candidate.time_utc} onClick={() => chooseDate(candidate)}>
            <strong>{candidate.time_utc.slice(0, 10)} · {candidate.time_utc.slice(11, 16)} UTC</strong>
            <span>{Math.abs(candidate.delta_hours)} h {candidate.delta_hours < 0 ? 'antes' : 'después'}</span>
          </button>)}
          {alternatives.reason && <p>{alternatives.reason}</p>}
          {alternatives.mode === 'location' && alternatives.candidates.length > 0 && <small>Al seleccionar un punto, Horizons confirma la posición exacta.</small>}
        </div>}
      </details>
    </section>
  )
}

export default MissionAssessment
