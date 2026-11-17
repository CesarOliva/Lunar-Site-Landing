import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import sceneCatalog from '../../../data/apollo_scenes.json'
import '../../estilos/misiones/MissionAssessment.css'

const utcValue = (value) => `${value.length === 16 ? `${value}:00` : value}Z`
const apiBase = import.meta.env.VITE_API_URL ?? ''

async function readApiResponse(response) {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error(response.ok
      ? 'The lunar service responded with no data. Check that lunar_api.py is still running and try again.'
      : `The lunar service returned no details (HTTP ${response.status}). Check that lunar_api.py is still running.`)
  }

  let result
  try {
    result = JSON.parse(body)
  } catch {
    throw new Error(`The lunar service returned an invalid response (HTTP ${response.status}). Check that lunar_api.py is still running.`)
  }

  if (!response.ok) {
    throw new Error(result.error ?? `Query error (${response.status}).`)
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
        {visible ? 'Visible above terrain' : blocked ? 'Hidden by terrain' : 'Terrain undetermined'}
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
  const statusLabel = assessment?.status_label ?? 'Indeterminate'

  async function evaluateSite(lat = Number(latitude), lon = Number(longitude), time = utcValue(dateTime)) {
    setLoading(true)
    setError('')
    setAlternatives(null)
    try {
      const response = await fetch(`${apiBase}/api/scene`, {
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
      setError(queryError instanceof Error ? queryError.message : 'The local lunar service could not be queried.')
    } finally {
      setLoading(false)
    }
  }

  async function findAlternatives(mode) {
    setSearching(mode)
    setError('')
    setAlternatives(null)
    try {
      const response = await fetch(`${apiBase}/api/alternatives`, {
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
      setError(searchError instanceof Error ? searchError.message : 'Alternatives could not be searched.')
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
    <details className="mission-assessment" aria-labelledby={`assessment-${mission.id}`}>
      <summary className="mission-assessment-heading">
        <h3 id={`assessment-${mission.id}`}>Landing conditions</h3>
        <ChevronDown className="mission-assessment-chevron" size={18} aria-hidden="true" />
      </summary>

      <div className="mission-assessment-content">
        <div className="mission-assessment-meta">
          <p>{assessedLive ? 'Horizons query for the chosen point and moment' : `Calculated date · ${currentScene.time_utc.slice(0, 10)} · ${currentScene.time_utc.slice(11, 16)} UT`}</p>
          <span className={`mission-assessment-status is-${status}`}>{statusLabel}</span>
        </div>
        {assessment?.coverage === 'available' ? <>
          <p className="mission-assessment-slope">Maximum slope <strong>{assessment.max_slope_deg.toFixed(2)}°</strong><span>limit {assessment.slope_limit_deg.toFixed(1)}° · area {assessment.landing_area_diameter_m} m</span></p>
          <div className="mission-assessment-angles">
            <Angle label="Sun" body={currentScene.sun} />
            <Angle label="Earth" body={currentScene.earth} />
          </div>
          <p className="mission-assessment-source">{`The LOLA grid has cells of about ${assessment.resolution_m} m; the horizon searches for terrain out to ${assessment.profile_radius_km} km, every ${assessment.azimuth_step_deg}\u00b0 of azimuth.`}</p>
          {assessment.limitations?.length > 0 && <details className="mission-assessment-limits"><summary>Scope of the calculation</summary><ul>{assessment.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
        </> : <p className="mission-assessment-reason">{assessment?.reason ?? 'There is not enough LOLA coverage to assess this site.'}</p>}

        <details className="mission-assessment-query">
          <summary>Assess another date or coordinates</summary>
          <form onSubmit={(event) => { event.preventDefault(); void evaluateSite() }}>
            <label>Latitude (°)<input type="number" min="-90" max="90" step="0.000001" required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
            <label>Longitude · east positive (°)<input type="number" min="-180" max="180" step="0.000001" required value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
            <label className="mission-assessment-date">UTC date and time<input type="datetime-local" min="1962-01-20T00:00" step="1" required value={dateTime} onChange={(event) => setDateTime(event.target.value)} /></label>
            <button type="submit" disabled={loading || Boolean(searching)}>{loading ? 'Calculating…' : 'Run assessment'}</button>
          </form>
          {loading && <p className="mission-assessment-message" role="status">Querying ephemerides and topographic profile…</p>}
          {error && <p className="mission-assessment-error" role="alert">{error}</p>}
          {assessedLive && status === 'unfavorable' && <div className="mission-alternative-actions">
            <button type="button" disabled={loading || Boolean(searching)} onClick={() => void findAlternatives('location')}>{searching === 'location' ? 'Searching…' : 'Find a nearby viable point'}</button>
            <button type="button" disabled={loading || Boolean(searching)} onClick={() => void findAlternatives('date')}>{searching === 'date' ? 'Searching…' : 'Find another date'}</button>
          </div>}
          {searching && <p className="mission-assessment-message" role="status">{searching === 'location' ? 'Searching within a 5 km radius…' : 'Searching hours within ±7 days…'}</p>}
          {alternatives && <div className="mission-alternatives" aria-live="polite">
            {alternatives.mode === 'location' ? alternatives.candidates.map((candidate) => <button type="button" key={`${candidate.latitude_deg}-${candidate.longitude_deg}`} onClick={() => chooseLocation(candidate)}>
              <strong>{candidate.latitude_deg.toFixed(5)}°, {candidate.longitude_deg.toFixed(5)}°</strong>
              <span>{(candidate.distance_m / 1000).toFixed(1)} km · slope {candidate.max_slope_deg.toFixed(2)}°</span>
            </button>) : alternatives.candidates.map((candidate) => <button type="button" key={candidate.time_utc} onClick={() => chooseDate(candidate)}>
              <strong>{candidate.time_utc.slice(0, 10)} · {candidate.time_utc.slice(11, 16)} UTC</strong>
              <span>{Math.abs(candidate.delta_hours)} h {candidate.delta_hours < 0 ? 'earlier' : 'later'}</span>
            </button>)}
            {alternatives.reason && <p>{alternatives.reason}</p>}
            {alternatives.mode === 'location' && alternatives.candidates.length > 0 && <small>When you select a point, Horizons confirms the exact position.</small>}
          </div>}
        </details>
      </div>
    </details>
  )
}

export default MissionAssessment
