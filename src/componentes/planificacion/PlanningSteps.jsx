import { lazy, Suspense, useState } from 'react'
import { Check, Lock, MapPin } from 'lucide-react'
import visibilitySite from '../../../data/visibility-site.json'
import { formatAngle } from './PlanningVisibility'
import missionPhoto1 from '../../foto1.jpeg'
import missionPhoto2 from '../../foto2.jpeg'
import missionPhoto3 from '../../foto3.jpeg'
import missionPhoto4 from '../../foto4.jpeg'

const PlanningSimulation = lazy(() => import('./PlanningSimulation'))

// --- Datos del formulario ---
export const missionTypes = [
  {
    id: 'robotic',
    letter: 'A',
    photo: missionPhoto1,
    label: 'Uncrewed robotic mission',
    description: 'A lander or rover operates autonomously at the south pole, with no crew on board. It navigates, takes measurements and sends data to Earth continuously. It is the cheapest and lowest-risk option for exploring permanently shadowed regions and studying the ice or the terrain.',
    objectives: ['Ice study', 'Terrain mapping', 'Scientific experiments'],
    payloads: ['Instruments', 'Rover and instruments'],
    conditionalSteps: [],
    requirements: ['Autonomous navigation', 'Power to operate', 'No life support'],
    excluded: ['Crew safety', 'Sample return'],
  },
  {
    id: 'crewed-short',
    letter: 'B',
    photo: missionPhoto2,
    label: 'Short-duration crewed mission',
    description: 'A crew lands, explores the surface during a brief stay and returns. It includes a habitable module, suits for extravehicular activity and life support for a few days. It enables direct scientific work with less exposure and lower resource consumption.',
    objectives: ['Ice study', 'Terrain mapping', 'Sample collection'],
    payloads: ['Crewed module', 'Crewed module and rover'],
    conditionalSteps: ['crew'],
    requirements: ['Life support', 'EVA suits', 'Crew safety'],
    excluded: ['Long-duration logistics', 'Automated sample return'],
  },
  {
    id: 'crewed-long',
    letter: 'C',
    photo: missionPhoto3,
    label: 'Long-duration crewed mission',
    description: 'A crew maintains a prolonged presence on the surface, with a stable habitat and work routines. It requires redundant supplies and power, radiation protection and, if possible, use of lunar resources. It is the most complex mission and the one that most paves the way for a permanent base.',
    objectives: ['Ice study', 'Terrain mapping', 'Use of lunar resources'],
    payloads: ['Crewed module', 'Base and rover'],
    conditionalSteps: ['crew', 'logistics'],
    requirements: ['Life support', 'Redundant supplies and power', 'Radiation protection'],
    excluded: ['Automated sample return'],
  },
  {
    id: 'sample-return',
    letter: 'D',
    photo: missionPhoto4,
    label: 'Robotic sample-return mission',
    description: 'A robotic system collects lunar material, such as ice, regolith or rock, and stores it. An ascent vehicle then lifts it off the Moon and a capsule returns it to Earth. It makes it possible to analyze the samples in a laboratory without sending people.',
    objectives: ['Ice samples', 'Regolith samples', 'Rock samples'],
    payloads: ['Collector arm', 'Rover and sampling system'],
    conditionalSteps: ['sample'],
    requirements: ['Collection and storage', 'Ascent from the Moon', 'Return capsule'],
    excluded: ['Life support', 'Crew safety'],
  },
]
export const initialForm = {
  name: 'Polar mission 01',
  missionType: 'robotic',
  objective: 'Ice study',
  duration: '7 days',
  durationDays: '7',
  vehicle: 'Not defined',
  mass: '',
  launchSite: 'Kennedy Space Center (NASA precedent)',
  payload: 'Instruments',
  propulsion: 'Chemical',
  launchWindow: 'Not defined',
  crewSize: '2 people',
  evaPlan: '1 moonwalk',
  lifeSupport: 'Integrated',
  habitatControl: 'Full system',
  supplies: '30 days',
  redundancy: 'Double',
  isru: 'Assessment',
  sampleTarget: 'Water ice',
  sampleCollection: 'Collector rover',
  sampleReturn: 'Return capsule',
  site: 'site04',
  latitude: '-89.7668',
  longitude: '188.13',
  elevation: '1500',
  landingArea: 'Radius 100 m',
  maxSlope: '5°',
  dateTime: '2026-11-14T12:00',
  compareDate: '2026-12-10',
}

export function createDemoForecast(dateTime, latitude, longitude) {
  const timestamp = Date.parse(`${dateTime}:00Z`)
  if (!Number.isFinite(timestamp)) return null

  const hour = Math.floor(timestamp / 3600000)
  const locationSeed = Math.floor(Math.abs(Number(latitude) * 10 + Number(longitude)))
  const seed = Math.abs(hour + locationSeed) % 10
  const temperatures = [
    [-184, -42], [-178, -36], [-191, -51], [-172, -33], [-186, -47],
    [-179, -39], [-188, -55], [-175, -31], [-182, -44], [-190, -49],
  ]
  const activity = ['Low', 'Moderate', 'High']

  return {
    status: 'demo',
    selected_at_utc: `${dateTime}:00Z`,
    illumination_hours: Number((5.5 + (seed % 8) * 0.9).toFixed(1)),
    surface_temperature_c: {
      minimum: temperatures[seed][0],
      maximum: temperatures[seed][1],
    },
    radiation_index_demo: 1 + (seed % 5),
    micrometeoroid_activity_demo: activity[seed % activity.length],
    communication_windows_demo: 1 + (seed % 4),
    communication_hours_demo: Number((2.5 + (seed % 7) * 0.7).toFixed(1)),
    terrain_assessment: 'Slope and obstacles not assessed',
  }
}

// --- Duración: dato del escenario, no una recomendación NASA ---
export const formatDays = (days) => `${days} ${Number(days) === 1 ? 'day' : 'days'}`

export function getDurationIssue(form) {
  const raw = String(form.durationDays ?? '').trim()
  const days = Number(raw)
  if (raw === '' || !Number.isFinite(days)) return 'Enter how many days the mission will last.'
  if (!Number.isInteger(days) || days < 1) return 'The duration must be a whole number of days, 1 or more.'
  return ''
}

// --- Campo de opciones reutilizable ---
export function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <fieldset className="planning-fieldset">
      <legend>{label}</legend>
      <div className="planning-choices">
        {options.map((option) => (
          <button
            className={`planning-choice ${value === option ? 'is-selected' : ''}`}
            type="button"
            key={option}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
// --- Propulsión: perfiles cualitativos y trayectoria ilustrativa ---
const propulsionProfiles = {
  'Chemical': { thrust: 5, efficiency: 2, transit: 'Days', seconds: 3, turns: 0, note: 'A short, powerful burn takes the ship straight to the Moon.' },
  'Electric': { thrust: 1, efficiency: 5, transit: 'Months', seconds: 7, turns: 4, note: 'Gentle, continuous thrust: the ship spirals around the Earth before departing.' },
  'Hybrid': { thrust: 3, efficiency: 3, transit: 'Weeks', seconds: 5, turns: 1.5, note: 'A strong first burn followed by a gentle-thrust phase reduces the fuel.' },
}

function trajectoryPath(turns) {
  const earth = { x: 70, y: 100 }
  const moon = { x: 450, y: 100 }
  if (turns === 0) return `M ${earth.x + 18} ${earth.y - 8} Q 260 ${earth.y - 100} ${moon.x - 9} ${moon.y - 6}`
  const steps = Math.round(turns * 40)
  let path = ''
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps
    const angle = -Math.PI / 2 + progress * turns * 2 * Math.PI
    const radius = 28 + progress * 24
    path += `${index === 0 ? 'M' : 'L'} ${(earth.x + radius * Math.cos(angle)).toFixed(1)} ${(earth.y + radius * Math.sin(angle)).toFixed(1)} `
  }
  const endAngle = -Math.PI / 2 + turns * 2 * Math.PI
  const above = Math.sin(endAngle) < 0
  return `${path}Q 260 ${above ? 8 : 192} ${moon.x - 9} ${moon.y + (above ? -6 : 6)}`
}

function Gauge({ value, max = 5 }) {
  return (
    <span className="gauge" aria-hidden="true">
      {Array.from({ length: max }, (_, index) => <i key={index} className={index < value ? 'is-on' : ''} />)}
    </span>
  )
}

function PropulsionPicker({ value, onChange }) {
  const profile = propulsionProfiles[value] ?? propulsionProfiles['Chemical']
  const path = trajectoryPath(profile.turns)
  const animate = typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <fieldset className="planning-fieldset propulsion-picker">
      <legend>Propulsion system</legend>
      <div className="propulsion-layout">
        <div className="propulsion-options">
          {Object.entries(propulsionProfiles).map(([name, item]) => (
            <button className={`propulsion-option ${value === name ? 'is-selected' : ''}`} type="button" key={name} aria-pressed={value === name} onClick={() => onChange(name)}>
              <strong>{name}</strong>
              <small>Transit: {item.transit.toLowerCase()}</small>
            </button>
          ))}
        </div>
        <div className="propulsion-panel">
          <svg className="trajectory" viewBox="0 0 520 200" role="img" aria-label={`Illustrative trajectory with ${value.toLowerCase()} propulsion. ${profile.note}`}>
            <line className="traj-axis" x1="88" y1="100" x2="441" y2="100" />
            <circle className="traj-earth" cx="70" cy="100" r="18" />
            <circle className="traj-moon" cx="450" cy="100" r="8" />
            <path className="traj-path" key={value} d={path} pathLength="1" />
            {animate && (
              <rect className="traj-craft" key={`craft-${value}`} x="-3" y="-3" width="6" height="6">
                <animateMotion dur={`${profile.seconds}s`} repeatCount="indefinite" path={path} />
              </rect>
            )}
            <text className="traj-label" x="70" y="22" textAnchor="middle">Earth</text>
            <text className="traj-label" x="450" y="136" textAnchor="middle">Moon</text>
          </svg>
          <div className="propulsion-gauges">
            <div className="gauge-row"><span>Thrust</span><Gauge value={profile.thrust} /></div>
            <div className="gauge-row"><span>Efficiency</span><Gauge value={profile.efficiency} /></div>
          </div>
          <p className="planning-note">{profile.note} Qualitative reference values; the diagram is not to scale.</p>
        </div>
      </div>
    </fieldset>
  )
}

// --- Ventana de lanzamiento: meses dentro del intervalo de datos ---
const launchMonths = [
  { id: 'November 2026', label: 'November', days: 17 },
  { id: 'December 2026', label: 'December', days: 31 },
  { id: 'January 2027', label: 'January', days: 31 },
  { id: 'February 2027', label: 'February', days: 12 },
]

function LaunchWindowPicker({ value, onChange }) {
  const selected = launchMonths.find((month) => month.id === value)
  return (
    <fieldset className="planning-fieldset launch-window">
      <legend>Launch window (reference)</legend>
      <div className="window-strip">
        {launchMonths.map((month) => (
          <button className={`window-month ${value === month.id ? 'is-selected' : ''}`} type="button" key={month.id} style={{ flexGrow: month.days }} aria-pressed={value === month.id} onClick={() => onChange(value === month.id ? 'Not defined' : month.id)}>
            <strong>{month.label}</strong>
            <small>{month.days} days of data</small>
          </button>
        ))}
      </div>
      <p className="planning-hint">
        {selected
          ? `${selected.id}, within the local data range (Nov 14, 2026 to Feb 12, 2027). Press the month again to clear it.`
          : 'No window defined. Choose a month from the local data range.'}
      </p>
    </fieldset>
  )
}

// --- Sitio: mapa polar, distancias y criterios de aterrizaje ---
const MAP_CENTER = 150
const MAP_RADIUS = 120
const MOON_RADIUS_KM = 1737.4
const KM_PER_DEGREE = (MOON_RADIUS_KM * Math.PI) / 180
const mapRanges = [1, 5, 10]
const formatKm = (km) => `${km.toFixed(km < 10 ? 2 : 1)} km`

function polarPoint(latitude, longitude, range) {
  const colatitude = latitude + 90
  const distance = Math.min(Math.max(colatitude / range, 0), 1) * MAP_RADIUS
  const angle = (longitude * Math.PI) / 180
  return {
    x: MAP_CENTER + distance * Math.sin(angle),
    y: MAP_CENTER - distance * Math.cos(angle),
    inside: colatitude >= 0 && colatitude <= range,
  }
}

function distanceKm(latA, lonA, latB, lonB) {
  const rad = Math.PI / 180
  const dLat = (latB - latA) * rad
  const dLon = (lonB - lonA) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLon / 2) ** 2
  return 2 * MOON_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

function PolarMap({ form, update, coordinatesValid, range }) {
  const site = polarPoint(visibilitySite.latitude_deg, visibilitySite.longitude_east_deg, range)
  const point = coordinatesValid ? polarPoint(Number(form.latitude), Number(form.longitude), range) : null
  const placeOnMap = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * 300 - MAP_CENTER
    const y = ((event.clientY - box.top) / box.height) * 300 - MAP_CENTER
    const distance = Math.min(Math.hypot(x, y) / MAP_RADIUS, 1)
    const east = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
    update('site', 'custom')
    update('latitude', (-90 + distance * range).toFixed(4))
    update('longitude', east.toFixed(2))
  }
  return (
    <svg className="polar-map" viewBox="0 0 300 300" role="img" aria-label="Map of the lunar south pole. Click to place your own point." onClick={placeOnMap}>
      <circle className="polar-disc" cx={MAP_CENTER} cy={MAP_CENTER} r={MAP_RADIUS} />
      {[1, 2, 3].map((step) => (
        <circle className="polar-ring" key={step} cx={MAP_CENTER} cy={MAP_CENTER} r={(MAP_RADIUS * step) / 4} />
      ))}
      <line className="polar-spoke" x1={MAP_CENTER} y1={MAP_CENTER - MAP_RADIUS} x2={MAP_CENTER} y2={MAP_CENTER + MAP_RADIUS} />
      <line className="polar-spoke" x1={MAP_CENTER - MAP_RADIUS} y1={MAP_CENTER} x2={MAP_CENTER + MAP_RADIUS} y2={MAP_CENTER} />
      <text className="polar-label" x={MAP_CENTER} y="12" textAnchor="middle">0°</text>
      <text className="polar-label" x="297" y="154" textAnchor="end">90°</text>
      <text className="polar-label" x={MAP_CENTER} y="297" textAnchor="middle">180°</text>
      <text className="polar-label" x="3" y="154">270°</text>
      {[1, 2, 3, 4].map((step) => (
        <text className="polar-label" key={step} x={MAP_CENTER + 4} y={MAP_CENTER - (MAP_RADIUS * step) / 4 - 3}>
          {Number((-90 + (range * step) / 4).toFixed(2))}°
        </text>
      ))}
      <line className="polar-pole" x1={MAP_CENTER - 5} y1={MAP_CENTER} x2={MAP_CENTER + 5} y2={MAP_CENTER} />
      <line className="polar-pole" x1={MAP_CENTER} y1={MAP_CENTER - 5} x2={MAP_CENTER} y2={MAP_CENTER + 5} />
      {site.inside && (
        <g>
          <rect className="polar-site" x={site.x - 5} y={site.y - 5} width="10" height="10" />
          <text className="polar-label" x={site.x + 9} y={site.y + 4}>Site 04</text>
        </g>
      )}
      {form.site === 'custom' && point?.inside && (
        <g>
          <line className="polar-cross" x1={point.x - 11} y1={point.y} x2={point.x + 11} y2={point.y} />
          <line className="polar-cross" x1={point.x} y1={point.y - 11} x2={point.x} y2={point.y + 11} />
          <rect className="polar-point" x={point.x - 4} y={point.y - 4} width="8" height="8" />
        </g>
      )}
    </svg>
  )
}

const areaRadii = { 'Radius 100 m': 8, 'Radius 500 m': 17, 'Radius 1 km': 26 }
const AreaGlyph = ({ option }) => (
  <svg viewBox="0 0 56 56" aria-hidden="true">
    <circle className="glyph-line" cx="28" cy="28" r={areaRadii[option] ?? 8} />
    <circle className="glyph-dot" cx="28" cy="28" r="1.8" />
  </svg>
)
const SlopeGlyph = ({ option }) => {
  const rise = Math.tan(((parseInt(option, 10) || 0) * Math.PI) / 180) * 44
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true">
      <line className="glyph-ref" x1="6" y1="40" x2="50" y2="40" />
      <line className="glyph-line" x1="6" y1="40" x2="50" y2={(40 - rise).toFixed(1)} />
    </svg>
  )
}

function GlyphTiles({ label, options, value, onChange, Glyph }) {
  return (
    <fieldset className="planning-fieldset">
      <legend>{label}</legend>
      <div className="glyph-tiles">
        {options.map((option) => (
          <button className={`glyph-tile ${value === option ? 'is-selected' : ''}`} type="button" key={option} aria-pressed={value === option} onClick={() => onChange(option)}>
            <Glyph option={option} />
            <span>{option}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// --- Pasos del asistente ---
export function MissionStep({ form, missionProfile, update, selectMissionType, detailedPlan, onOpenDetailedPlan, planNotice }) {
  const durationIssue = getDurationIssue(form)
  const setDuration = (days) => {
    update('durationDays', days)
    update('duration', days.trim() === '' ? '' : formatDays(days))
  }
  return (
    <section className="mission-step" aria-labelledby="planning-title">
      <div className="mission-step-heading">
        <h2 id="planning-title">Trip <em>planning</em></h2>
        {detailedPlan ? (
          <span className="planning-detail-active">DETAILED PLAN ACTIVE</span>
        ) : (
          <button className="planning-detail-button" type="button" onClick={onOpenDetailedPlan}>
            Detailed plan
          </button>
        )}
      </div>
      {planNotice && <p className="planning-detail-notice" role="status">{planNotice}</p>}
      <label className="planning-label mission-name-field">
        Mission name
        <input value={form.name} maxLength={70} onChange={(event) => update('name', event.target.value)} />
      </label>
      <fieldset className="planning-fieldset mission-type-fieldset">
        <legend>Choose the mission type</legend>
        <div className="mission-type-grid">
          {missionTypes.map((type) => (
            <button
              className={`mission-type-option ${form.missionType === type.id ? 'is-selected' : ''}`}
              type="button"
              key={type.id}
              aria-pressed={form.missionType === type.id}
              onClick={() => selectMissionType(type.id)}
            >
              <span className="mission-type-photo">
                <span>{type.label}</span>
                <img src={type.photo} alt={type.label} onError={(event) => { event.currentTarget.style.display = 'none' }} />
              </span>
              <span className="mission-type-letter">{type.letter}</span>
              <span className="mission-type-copy">
                <strong>{type.label}</strong>
                <small className="mission-type-description">{type.description}</small>
                <span className="mission-type-requirements">
                  {type.requirements.join(' · ')}
                </span>
              </span>
              <span className="mission-type-check" aria-hidden="true">
                {form.missionType === type.id && <Check size={16} />}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="planning-form-grid">
        <ChoiceGroup
          label="Scientific objective"
          options={missionProfile.objectives}
          value={form.objective}
          onChange={(value) => update('objective', value)}
        />
        <fieldset className={`planning-fieldset duration-field ${durationIssue ? 'has-warning' : ''}`}>
          <legend>Estimated duration (days)</legend>
          <input
            className="duration-input"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={form.durationDays}
            aria-invalid={Boolean(durationIssue)}
            aria-describedby="duration-hint"
            onChange={(event) => setDuration(event.target.value)}
          />
          <p
            id="duration-hint"
            className={durationIssue ? 'planning-warning' : 'planning-hint'}
            role={durationIssue ? 'alert' : undefined}
          >
            {durationIssue || 'Scenario duration; not a recommendation or a NASA limit.'}
          </p>
        </fieldset>
      </div>
      <p className="planning-note">Profiles and objectives are presets; the duration belongs to the scenario, not a NASA limit.</p>
      <div className="mission-plan-preview">
        <strong>Your selection adjusts the plan</strong>
        <span>Included: {missionProfile.requirements.join(' · ')}.</span>
        <span>Omitted: {missionProfile.excluded.join(' · ')}.</span>
      </div>
    </section>
  )
}

export function VehicleStep({ form, missionProfile, update }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Vehicle and <em>launch</em></h2>
      <p className="planning-intro">Define the launcher and see how the trajectory changes when you choose the propulsion.</p>
      <div className="planning-form-grid">
        <label className="planning-label">
          Launcher / configuration
          <input value={form.vehicle} placeholder="Not defined" onChange={(event) => update('vehicle', event.target.value)} />
        </label>
        <label className="planning-label">
          Payload mass (kg)
          <input type="number" min="0" step="any" value={form.mass} placeholder="Not defined" onChange={(event) => update('mass', event.target.value)} />
        </label>
        <ChoiceGroup
          label="Launch site"
          options={['Kennedy Space Center (NASA precedent)', 'Vandenberg (NASA precedent)', 'Other / unverified']}
          value={form.launchSite}
          onChange={(value) => update('launchSite', value)}
        />
        <ChoiceGroup label="Payload" options={missionProfile.payloads} value={form.payload} onChange={(value) => update('payload', value)} />
        <div className="planning-span">
          <PropulsionPicker value={form.propulsion} onChange={(value) => update('propulsion', value)} />
        </div>
        <div className="planning-span">
          <LaunchWindowPicker value={form.launchWindow} onChange={(value) => update('launchWindow', value)} />
        </div>
      </div>
      <p className="planning-note">Historical NASA precedents; they do not indicate availability. Mass, window, payload and propulsion are not validated here.</p>
    </section>
  )
}

export function SiteStep({ form, update, updateCoordinate, coordinatesValid, altitudeValid, siteInputsValid }) {
  const [range, setRange] = useState(1)
  const latitude = Number(form.latitude)
  const longitude = Number(form.longitude)
  const poleKm = coordinatesValid ? (latitude + 90) * KM_PER_DEGREE : null
  const siteKm = coordinatesValid ? distanceKm(latitude, longitude, visibilitySite.latitude_deg, visibilitySite.longitude_east_deg) : null
  const outsideMap = coordinatesValid && latitude + 90 > range
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Landing <em>site</em></h2>
      <p className="planning-intro">Choose Site 04 or click on the map to place your own point. The coordinates update instantly.</p>
      <div className="site-explorer">
        <div className="polar-map-card">
          <PolarMap form={form} update={update} coordinatesValid={coordinatesValid} range={range} />
          <div className="map-zoom" role="group" aria-label="Map radius">
            {mapRanges.map((item) => (
              <button className={`planning-choice ${range === item ? 'is-selected' : ''}`} type="button" key={item} aria-pressed={range === item} onClick={() => setRange(item)}>
                {item}° · {Math.round(item * KM_PER_DEGREE)} km
              </button>
            ))}
          </div>
        </div>
        <div className="site-explorer-side">
          <button className={`site-option ${form.site === 'site04' ? 'is-selected' : ''}`} type="button" aria-pressed={form.site === 'site04'} onClick={() => {
            update('site', 'site04')
            updateCoordinate('latitude', String(visibilitySite.latitude_deg))
            updateCoordinate('longitude', String(visibilitySite.longitude_east_deg))
          }}>
            <span className="site-option-icon"><MapPin size={18} /></span>
            <strong>Shackleton · Site 04</strong>
            <small>Cartographic reference; its coordinates are fixed and locked.</small>
            <code>{visibilitySite.latitude_deg}° · {visibilitySite.longitude_east_deg}° E</code>
            <span className="site-data-badge"><Check size={12} /> LOLA model available</span>
          </button>
          <button className={`site-option ${form.site === 'custom' ? 'is-selected' : ''}`} type="button" aria-pressed={form.site === 'custom'} onClick={() => update('site', 'custom')}>
            <span className="site-option-icon"><MapPin size={18} /></span>
            <strong>Custom coordinates</strong>
            <small>Define a lunar point for your scenario.</small>
            <span className="site-custom-note">Visibility is not computed without terrain and ephemeris data.</span>
          </button>
          <div className="site-readouts">
            <div className="site-readout"><span>Distance to the south pole</span><strong>{poleKm === null ? '—' : formatKm(poleKm)}</strong></div>
            <div className="site-readout"><span>Distance to Site 04</span><strong>{siteKm === null ? '—' : formatKm(siteKm)}</strong></div>
          </div>
          {outsideMap && <p className="planning-hint">The point is outside this radius. Widen the map to see it.</p>}
        </div>
      </div>
      <div className="planning-coordinate-grid">
        <label className="planning-label">
          Planetocentric latitude (°)
          <input type="number" min="-90" max="90" step="0.0001" value={form.latitude} onChange={(event) => updateCoordinate('latitude', event.target.value)} disabled={form.site !== 'custom'} aria-describedby="site-coordinate-status" aria-invalid={!coordinatesValid} />
        </label>
        <label className="planning-label">
          East longitude (°)
          <input type="number" min="0" max="360" step="0.0001" value={form.longitude} onChange={(event) => updateCoordinate('longitude', event.target.value)} disabled={form.site !== 'custom'} aria-describedby="site-coordinate-status" aria-invalid={!coordinatesValid} />
        </label>
      </div>
      <p className="site-coordinate-status" id="site-coordinate-status" role="status">
        {form.site === 'custom'
          ? 'Custom coordinates.'
          : 'Reference coordinates for Shackleton · Site 04.'}
      </p>
      <div className="planning-form-grid site-constraints">
        <label className="planning-label">
          Altitude above the mean lunar radius (m)
          <input type="number" step="1" value={form.elevation} onChange={(event) => update('elevation', event.target.value)} aria-invalid={!altitudeValid} />
        </label>
        <span />
        <GlyphTiles label="Landing area" options={['Radius 100 m', 'Radius 500 m', 'Radius 1 km']} value={form.landingArea} onChange={(value) => update('landingArea', value)} Glyph={AreaGlyph} />
        <GlyphTiles label="Maximum allowed slope" options={['5°', '10°', '15°']} value={form.maxSlope} onChange={(value) => update('maxSlope', value)} Glyph={SlopeGlyph} />
      </div>
      <p className={`planning-hint ${siteInputsValid ? '' : 'planning-error'}`}>
        {siteInputsValid ? 'Planetocentric ME frame · assess the area and slope before comparing visibility.' : 'Enter a valid latitude, an east longitude from 0° to 360° and a numeric altitude.'}
      </p>
      <p className="planning-note">Site 04 is a cartographic reference, not an approved site. Area and slope are scenario parameters, not universal NASA limits. The map uses a simplified polar projection.</p>
    </section>
  )
}

export function CrewStep({ form, update }) {
  return (
    <section aria-labelledby="crew-step-title">
      <h2 id="crew-step-title">Crew and <em>life support</em></h2>
      <p className="planning-intro">This step is only added to crewed missions. For a robotic mission these requirements are omitted.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Crew size" options={['2 people', '3 people', '4 people']} value={form.crewSize} onChange={(value) => update('crewSize', value)} />
        <ChoiceGroup label="Extravehicular activity (EVA) plan" options={['No moonwalks', '1 moonwalk', '2 or more moonwalks']} value={form.evaPlan} onChange={(value) => update('evaPlan', value)} />
        <ChoiceGroup label="Life support" options={['Integrated', 'Partial redundancy', 'Full redundancy']} value={form.lifeSupport} onChange={(value) => update('lifeSupport', value)} />
        <ChoiceGroup label="Habitat environmental control" options={['Temperature', 'Temperature and pressure', 'Full system']} value={form.habitatControl} onChange={(value) => update('habitatControl', value)} />
      </div>
      <div className="mission-plan-preview">
        <strong>Included requirements</strong>
        <span>The habitable module, oxygen, water, pressure and EVA suits are part of this mission.</span>
      </div>
    </section>
  )
}

export function LogisticsStep({ form, update }) {
  return (
    <section aria-labelledby="logistics-step-title">
      <h2 id="logistics-step-title">Long-duration <em>logistics</em></h2>
      <p className="planning-intro">Only appears for a long-duration crewed mission.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Reserve supplies" options={['30 days', '60 days', '90 days']} value={form.supplies} onChange={(value) => update('supplies', value)} />
        <ChoiceGroup label="Power redundancy" options={['Single', 'Double', 'Triple']} value={form.redundancy} onChange={(value) => update('redundancy', value)} />
        <ChoiceGroup label="Use of lunar resources (ISRU)" options={['No local use', 'Assessment', 'Local production']} value={form.isru} onChange={(value) => update('isru', value)} />
      </div>
      <div className="mission-plan-preview">
        <strong>Omitted on short stays</strong>
        <span>Extended reserves, power redundancy and the use of local resources are added because of the selected duration.</span>
      </div>
    </section>
  )
}

export function SampleStep({ form, update }) {
  return (
    <section aria-labelledby="sample-step-title">
      <h2 id="sample-step-title">Sample <em>return</em></h2>
      <p className="planning-intro">This step is only included when the mission must bring lunar material back to Earth.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Target material" options={['Water ice', 'Regolith', 'Lunar rocks']} value={form.sampleTarget} onChange={(value) => update('sampleTarget', value)} />
        <ChoiceGroup label="Collection system" options={['Robotic arm', 'Collector rover', 'Drill and container']} value={form.sampleCollection} onChange={(value) => update('sampleCollection', value)} />
        <ChoiceGroup label="Return system" options={['Return capsule', 'Ascent vehicle and capsule']} value={form.sampleReturn} onChange={(value) => update('sampleReturn', value)} />
      </div>
      <div className="mission-plan-preview">
        <strong>Included requirements</strong>
        <span>The plan reserves room for storage, ascent from the Moon and recovery of the capsule.</span>
      </div>
    </section>
  )
}

const activityLevel = { Low: 1, Moderate: 2, High: 3 }

export function ForecastStep({ forecast }) {
  if (!forecast) {
    return (
      <section aria-labelledby="forecast-title">
        <h2 id="forecast-title">Environment <em>forecast</em></h2>
        <p className="planning-intro">Select a date and time to see the simulation.</p>
      </section>
    )
  }
  const { minimum, maximum } = forecast.surface_temperature_c
  const windows = forecast.communication_windows_demo
  const windowWidth = Math.min(forecast.communication_hours_demo / windows / 24 * 100, 100 / windows - 2)

  return (
    <section aria-labelledby="forecast-title">
      <h2 id="forecast-title">Environment and <em>risks</em></h2>
      <p className="planning-intro">Automatic preview for the selected date. Move the date above and the bars change.</p>
      <p className="forecast-time">Scenario: {forecast.selected_at_utc.replace('T', ' · ').replace(':00Z', ' UT')}</p>
      <div className="forecast-warning" role="note">
        <strong>Simulation with fictitious data</strong>
        <span>This is not a real forecast. The Moon has no weather like Earth; these values only show the future backend experience.</span>
      </div>
      <div className="forecast-grid">
        <article className="forecast-card">
          <span>Simulated illumination</span>
          <strong>{forecast.illumination_hours} h</strong>
          <div className="meter" aria-hidden="true"><i className="meter-fill" style={{ left: 0, width: `${(forecast.illumination_hours / 24) * 100}%` }} /></div>
          <small>of light in 24 h</small>
        </article>
        <article className="forecast-card">
          <span>Surface temperature</span>
          <strong>{minimum}° to {maximum}°C</strong>
          <div className="meter" aria-hidden="true"><i className="meter-fill" style={{ left: `${((minimum + 200) / 200) * 100}%`, width: `${((maximum - minimum) / 200) * 100}%` }} /></div>
          <small>illustrative range on a scale from -200° to 0°C</small>
        </article>
        <article className="forecast-card">
          <span>Radiation · demo index</span>
          <strong>{forecast.radiation_index_demo} / 5</strong>
          <Gauge value={forecast.radiation_index_demo} />
          <small>no dose or protection assessment</small>
        </article>
        <article className="forecast-card">
          <span>Micrometeoroids</span>
          <strong>{forecast.micrometeoroid_activity_demo} activity</strong>
          <Gauge value={activityLevel[forecast.micrometeoroid_activity_demo] ?? 1} max={3} />
          <small>no impact probability calculated</small>
        </article>
        <article className="forecast-card">
          <span>Simulated communications</span>
          <strong>{windows} {windows === 1 ? 'window' : 'windows'}</strong>
          <div className="meter" aria-hidden="true">
            {Array.from({ length: windows }, (_, index) => (
              <i className="meter-block" key={index} style={{ left: `${(index * 100) / windows + 1}%`, width: `${windowWidth}%` }} />
            ))}
          </div>
          <small>{forecast.communication_hours_demo} h spread over 24 h · link not validated</small>
        </article>
        <article className="forecast-card">
          <span>Terrain and landing</span>
          <strong>{forecast.terrain_assessment}</strong>
          <small>requires topographic data for the site</small>
        </article>
      </div>
      <p className="planning-note">The simulation changes with date and coordinates. Real risks require NASA/backend models and data.</p>
    </section>
  )
}

export function SummaryStep({ form, missionProfile, isModeledSite, selectedSample, visibilityError, demoForecast, downloadPlan, detailedPlan }) {
  const [simulation, setSimulation] = useState(0)
  return (
    <section className="summary-step" aria-labelledby="planning-title">
      <h2 id="planning-title">Mission <em>summary</em></h2>
      <p className="planning-intro">Review the configuration and download the plan.</p>
      <div className="summary-card">
        <div className="summary-hero">
          <img className="summary-mission-photo" src={missionProfile.photo} alt={missionProfile.label} />
          <div className="summary-heading"><div><span>MISSION PLAN</span><strong>{form.name || 'Unnamed mission'}</strong></div></div>
        </div>
        <dl className="summary-list">
          <div><dt>Profile</dt><dd>{missionProfile.label}</dd></div>
          <div><dt>Objective</dt><dd>{form.objective} · {form.duration}</dd></div>
          <div><dt>Launcher and payload</dt><dd>{form.vehicle || 'Not defined'} · {form.mass ? `${form.mass} kg` : 'Mass not defined'} · {form.payload}</dd></div>
          <div><dt>Launch</dt><dd>{form.launchSite} · {form.launchWindow}</dd></div>
          <div><dt>Site</dt><dd>{isModeledSite ? visibilitySite.name : 'Custom coordinates'}</dd></div>
          <div><dt>Area and slope</dt><dd>{form.landingArea} · {form.maxSlope}</dd></div>
          <div><dt>Altitude</dt><dd>{form.elevation} m above the mean lunar radius</dd></div>
          <div><dt>Coordinates</dt><dd>{Number(form.latitude).toFixed(4)}° · {Number(form.longitude).toFixed(4)}° E</dd></div>
          <div><dt>Landing (UTC)</dt><dd>{form.dateTime.replace('T', ' · ')} UT</dd></div>
          {demoForecast && (
            <div><dt>Environment / risks</dt><dd>Fictitious simulation · {demoForecast.illumination_hours} h of light · micrometeoroids {demoForecast.micrometeoroid_activity_demo.toLowerCase()}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('crew') && (
            <div><dt>Crew and support</dt><dd>{form.crewSize} · {form.evaPlan} · {form.lifeSupport}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('logistics') && (
            <div><dt>Logistics</dt><dd>{form.supplies} reserve · {form.redundancy} power · ISRU {form.isru}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('sample') && (
            <div><dt>Sample return</dt><dd>{form.sampleTarget} · {form.sampleCollection} · {form.sampleReturn}</dd></div>
          )}
        </dl>
        {selectedSample && (
          <div className="summary-visibility">
            <span>Sun {selectedSample.sun.state === 'visible' ? 'visible' : 'hidden'} <b>{formatAngle(selectedSample.sun.elevation)}</b></span>
            <span>Earth {selectedSample.earth.state === 'visible' ? 'visible' : 'hidden'} <b>{formatAngle(selectedSample.earth.elevation)}</b></span>
          </div>
        )}
        {isModeledSite && visibilityError && (
          <p className="planning-error summary-data-note" role="alert">{visibilityError}</p>
        )}
        {!isModeledSite && (
          <p className="summary-data-note">There is no visibility calculation for custom coordinates.</p>
        )}
      </div>
      {detailedPlan ? (
        <>
          <button className="download-plan-button" type="button" onClick={downloadPlan}>
            Download plan
          </button>
          <button className="download-plan-button sim-launch-button" type="button" onClick={() => setSimulation((run) => run + 1)}>
            {simulation ? 'Restart simulation' : 'Simulate mission'}
          </button>
        </>
      ) : (
        <>
          <p className="planning-locked-actions-note" id="planning-locked-actions-note">
            The PDF and the final simulation are included in the detailed plan.
          </p>
          <button className="download-plan-button is-locked" type="button" disabled aria-describedby="planning-locked-actions-note">
            <Lock size={15} /> Download plan
          </button>
          <button className="download-plan-button sim-launch-button is-locked" type="button" disabled aria-describedby="planning-locked-actions-note">
            <Lock size={15} /> Simulate mission
          </button>
        </>
      )}
      {simulation > 0 && (
        <Suspense fallback={<p className="planning-hint">Loading simulation…</p>}>
          <PlanningSimulation key={simulation} form={form} missionProfile={missionProfile} onClose={() => setSimulation(0)} />
        </Suspense>
      )}
    </section>
  )
}