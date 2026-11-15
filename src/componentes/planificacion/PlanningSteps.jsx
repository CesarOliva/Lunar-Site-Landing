import { useState } from 'react'
import { Check, MapPin } from 'lucide-react'
import visibilitySite from '../../../data/visibility-site.json'
import { formatAngle } from './PlanningVisibility'
import missionPhoto1 from '../../foto1.jpeg'
import missionPhoto2 from '../../foto2.jpeg'
import missionPhoto3 from '../../foto3.jpeg'
import missionPhoto4 from '../../foto4.jpeg'

// --- Datos del formulario ---
export const missionTypes = [
  {
    id: 'robotic',
    letter: 'A',
    photo: missionPhoto1,
    label: 'Misión robótica no tripulada',
    description: 'Un aterrizador o rover opera de forma autónoma en el polo sur, sin tripulación a bordo. Navega, toma mediciones y envía datos a la Tierra de forma continua. Es la opción más económica y de menor riesgo para explorar zonas de sombra permanente y estudiar el hielo o el terreno.',
    objectives: ['Estudio de hielo', 'Mapeo del terreno', 'Experimentos científicos'],
    payloads: ['Instrumentos', 'Rover e instrumentos'],
    conditionalSteps: [],
    requirements: ['Navegación autónoma', 'Energía para operar', 'Sin soporte vital'],
    excluded: ['Seguridad de tripulación', 'Retorno de muestras'],
  },
  {
    id: 'crewed-short',
    letter: 'B',
    photo: missionPhoto2,
    label: 'Misión tripulada de corta duración',
    description: 'Una tripulación aterriza, explora la superficie durante una estancia breve y regresa. Incluye un módulo habitable, trajes para actividad extravehicular y soporte vital para pocos días. Permite hacer trabajo científico directo con menor exposición y menor consumo de recursos.',
    objectives: ['Estudio de hielo', 'Mapeo del terreno', 'Recolección de muestras'],
    payloads: ['Módulo habitado', 'Módulo habitado y rover'],
    conditionalSteps: ['crew'],
    requirements: ['Soporte vital', 'Trajes para EVA', 'Seguridad de la tripulación'],
    excluded: ['Logística de larga duración', 'Retorno automatizado de muestras'],
  },
  {
    id: 'crewed-long',
    letter: 'C',
    photo: missionPhoto3,
    label: 'Misión tripulada de larga duración',
    description: 'Una tripulación mantiene una presencia prolongada en la superficie, con un hábitat estable y rutinas de trabajo. Requiere suministros y energía redundantes, protección contra la radiación y, si es posible, aprovechar recursos lunares. Es la misión más compleja y la que más prepara el camino para una base permanente.',
    objectives: ['Estudio de hielo', 'Mapeo del terreno', 'Uso de recursos lunares'],
    payloads: ['Módulo habitado', 'Base y rover'],
    conditionalSteps: ['crew', 'logistics'],
    requirements: ['Soporte vital', 'Suministros y energía redundantes', 'Protección radiológica'],
    excluded: ['Retorno automatizado de muestras'],
  },
  {
    id: 'sample-return',
    letter: 'D',
    photo: missionPhoto4,
    label: 'Misión robótica con retorno de muestras',
    description: 'Un sistema robótico recolecta material lunar, como hielo, regolito o roca, y lo almacena. Después un vehículo de ascenso lo saca de la Luna y una cápsula lo devuelve a la Tierra. Permite analizar las muestras en laboratorio sin enviar personas.',
    objectives: ['Muestras de hielo', 'Muestras del regolito', 'Muestras de roca'],
    payloads: ['Brazo recolector', 'Rover y sistema de muestreo'],
    conditionalSteps: ['sample'],
    requirements: ['Recolección y almacenamiento', 'Ascenso desde la Luna', 'Cápsula de retorno'],
    excluded: ['Soporte vital', 'Seguridad de tripulación'],
  },
]
export const initialForm = {
  name: 'Misión polar 01',
  missionType: 'robotic',
  objective: 'Estudio de hielo',
  duration: '7 días',
  durationDays: '7',
  vehicle: 'Sin definir',
  mass: '',
  launchSite: 'Kennedy Space Center (antecedente NASA)',
  payload: 'Instrumentos',
  propulsion: 'Química',
  launchWindow: 'No definida',
  crewSize: '2 personas',
  evaPlan: '1 caminata',
  lifeSupport: 'Integrado',
  habitatControl: 'Sistema completo',
  supplies: '30 días',
  redundancy: 'Doble',
  isru: 'Evaluación',
  sampleTarget: 'Hielo de agua',
  sampleCollection: 'Rover recolector',
  sampleReturn: 'Cápsula de retorno',
  site: 'site04',
  latitude: '-89.7668',
  longitude: '188.13',
  elevation: '1500',
  landingArea: 'Radio de 100 m',
  maxSlope: '5°',
  dateTime: '2026-11-14T12:00',
  compareDate: '2026-12-10',
}

// --- Duración: dato del escenario, no una recomendación NASA ---
export const formatDays = (days) => `${days} ${Number(days) === 1 ? 'día' : 'días'}`

export function getDurationIssue(form) {
  const raw = String(form.durationDays ?? '').trim()
  const days = Number(raw)
  if (raw === '' || !Number.isFinite(days)) return 'Escribe cuántos días durará la misión.'
  if (!Number.isInteger(days) || days < 1) return 'La duración debe ser un número entero de días, de 1 en adelante.'
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
  'Química': { thrust: 5, efficiency: 2, transit: 'Días', seconds: 3, turns: 0, note: 'Un impulso corto y potente lleva la nave directo a la Luna.' },
  'Eléctrica': { thrust: 1, efficiency: 5, transit: 'Meses', seconds: 7, turns: 4, note: 'Empuje suave y continuo: la nave espira alrededor de la Tierra antes de partir.' },
  'Híbrida': { thrust: 3, efficiency: 3, transit: 'Semanas', seconds: 5, turns: 1.5, note: 'Un primer impulso fuerte y una fase de empuje suave reducen el combustible.' },
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
  const profile = propulsionProfiles[value] ?? propulsionProfiles['Química']
  const path = trajectoryPath(profile.turns)
  const animate = typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <fieldset className="planning-fieldset propulsion-picker">
      <legend>Sistema de propulsión</legend>
      <div className="propulsion-layout">
        <div className="propulsion-options">
          {Object.entries(propulsionProfiles).map(([name, item]) => (
            <button className={`propulsion-option ${value === name ? 'is-selected' : ''}`} type="button" key={name} aria-pressed={value === name} onClick={() => onChange(name)}>
              <strong>{name}</strong>
              <small>Tránsito: {item.transit.toLowerCase()}</small>
            </button>
          ))}
        </div>
        <div className="propulsion-panel">
          <svg className="trajectory" viewBox="0 0 520 200" role="img" aria-label={`Trayectoria ilustrativa con propulsión ${value.toLowerCase()}. ${profile.note}`}>
            <line className="traj-axis" x1="88" y1="100" x2="441" y2="100" />
            <circle className="traj-earth" cx="70" cy="100" r="18" />
            <circle className="traj-moon" cx="450" cy="100" r="8" />
            <path className="traj-path" key={value} d={path} pathLength="1" />
            {animate && (
              <rect className="traj-craft" key={`craft-${value}`} x="-3" y="-3" width="6" height="6">
                <animateMotion dur={`${profile.seconds}s`} repeatCount="indefinite" path={path} />
              </rect>
            )}
            <text className="traj-label" x="70" y="22" textAnchor="middle">Tierra</text>
            <text className="traj-label" x="450" y="136" textAnchor="middle">Luna</text>
          </svg>
          <div className="propulsion-gauges">
            <div className="gauge-row"><span>Empuje</span><Gauge value={profile.thrust} /></div>
            <div className="gauge-row"><span>Eficiencia</span><Gauge value={profile.efficiency} /></div>
          </div>
          <p className="planning-note">{profile.note} Valores cualitativos de referencia; el diagrama no está a escala.</p>
        </div>
      </div>
    </fieldset>
  )
}

// --- Ventana de lanzamiento: meses dentro del intervalo de datos ---
const launchMonths = [
  { id: 'Noviembre 2026', label: 'Noviembre', days: 17 },
  { id: 'Diciembre 2026', label: 'Diciembre', days: 31 },
  { id: 'Enero 2027', label: 'Enero', days: 31 },
  { id: 'Febrero 2027', label: 'Febrero', days: 12 },
]

function LaunchWindowPicker({ value, onChange }) {
  const selected = launchMonths.find((month) => month.id === value)
  return (
    <fieldset className="planning-fieldset launch-window">
      <legend>Ventana de lanzamiento (referencia)</legend>
      <div className="window-strip">
        {launchMonths.map((month) => (
          <button className={`window-month ${value === month.id ? 'is-selected' : ''}`} type="button" key={month.id} style={{ flexGrow: month.days }} aria-pressed={value === month.id} onClick={() => onChange(value === month.id ? 'No definida' : month.id)}>
            <strong>{month.label}</strong>
            <small>{month.days} días de datos</small>
          </button>
        ))}
      </div>
      <p className="planning-hint">
        {selected
          ? `${selected.id}, dentro del intervalo de datos locales (14 nov 2026 a 12 feb 2027). Pulsa el mes otra vez para quitarlo.`
          : 'Sin ventana definida. Elige un mes del intervalo de datos locales.'}
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
    <svg className="polar-map" viewBox="0 0 300 300" role="img" aria-label="Mapa del polo sur lunar. Haz clic para colocar un punto propio." onClick={placeOnMap}>
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

const areaRadii = { 'Radio de 100 m': 8, 'Radio de 500 m': 17, 'Radio de 1 km': 26 }
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
export function MissionStep({ form, missionProfile, update, selectMissionType }) {
  const durationIssue = getDurationIssue(form)
  const setDuration = (days) => {
    update('durationDays', days)
    update('duration', days.trim() === '' ? '' : formatDays(days))
  }
  return (
    <section className="mission-step" aria-labelledby="planning-title">
      <h2 id="planning-title">Planeación <em>de viaje</em></h2>
      <label className="planning-label mission-name-field">
        Nombre de la misión
        <input value={form.name} maxLength={70} onChange={(event) => update('name', event.target.value)} />
      </label>
      <fieldset className="planning-fieldset mission-type-fieldset">
        <legend>Elige el tipo de misión</legend>
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
          label="Objetivo científico"
          options={missionProfile.objectives}
          value={form.objective}
          onChange={(value) => update('objective', value)}
        />
        <fieldset className={`planning-fieldset duration-field ${durationIssue ? 'has-warning' : ''}`}>
          <legend>Duración estimada (días)</legend>
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
            {durationIssue || 'Duración del escenario; no es una recomendación ni un límite NASA.'}
          </p>
        </fieldset>
      </div>
      <p className="planning-note">Perfiles y objetivos son presets; la duración es del escenario, no un límite NASA.</p>
      <div className="mission-plan-preview">
        <strong>Tu selección ajusta el plan</strong>
        <span>Se incluirán: {missionProfile.requirements.join(' · ')}.</span>
        <span>Se omitirán: {missionProfile.excluded.join(' · ')}.</span>
      </div>
    </section>
  )
}

export function VehicleStep({ form, missionProfile, update }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Vehículo y <em>lanzamiento</em></h2>
      <p className="planning-intro">Define el lanzador y observa cómo cambia la trayectoria al elegir la propulsión.</p>
      <div className="planning-form-grid">
        <label className="planning-label">
          Lanzador / configuración
          <input value={form.vehicle} placeholder="Sin definir" onChange={(event) => update('vehicle', event.target.value)} />
        </label>
        <label className="planning-label">
          Masa de carga útil (kg)
          <input type="number" min="0" step="any" value={form.mass} placeholder="Sin definir" onChange={(event) => update('mass', event.target.value)} />
        </label>
        <ChoiceGroup
          label="Lugar de lanzamiento"
          options={['Kennedy Space Center (antecedente NASA)', 'Vandenberg (antecedente NASA)', 'Otro / sin verificar']}
          value={form.launchSite}
          onChange={(value) => update('launchSite', value)}
        />
        <ChoiceGroup label="Carga útil" options={missionProfile.payloads} value={form.payload} onChange={(value) => update('payload', value)} />
        <div className="planning-span">
          <PropulsionPicker value={form.propulsion} onChange={(value) => update('propulsion', value)} />
        </div>
        <div className="planning-span">
          <LaunchWindowPicker value={form.launchWindow} onChange={(value) => update('launchWindow', value)} />
        </div>
      </div>
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
      <h2 id="planning-title">Sitio de <em>aterrizaje</em></h2>
      <p className="planning-intro">Elige Shackleton o haz clic en el mapa para colocar un punto propio. Las coordenadas se actualizan al instante.</p>
      <div className="site-explorer">
        <div className="polar-map-card">
          <PolarMap form={form} update={update} coordinatesValid={coordinatesValid} range={range} />
          <div className="map-zoom" role="group" aria-label="Radio del mapa">
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
            <small>Referencia cartográfica; sus coordenadas están establecidas y bloqueadas.</small>
            <code>{visibilitySite.latitude_deg}° · {visibilitySite.longitude_east_deg}° E</code>
          </button>
          <button className={`site-option ${form.site === 'custom' ? 'is-selected' : ''}`} type="button" aria-pressed={form.site === 'custom'} onClick={() => update('site', 'custom')}>
            <span className="site-option-icon"><MapPin size={18} /></span>
            <strong>Coordenadas propias</strong>
            <small>Define un punto lunar para tu escenario.</small>
            <span className="site-custom-note">La visibilidad no se calcula sin datos de terreno y efemérides.</span>
          </button>
          <div className="site-readouts">
            <div className="site-readout"><span>Distancia al polo sur</span><strong>{poleKm === null ? '—' : formatKm(poleKm)}</strong></div>
            <div className="site-readout"><span>Distancia a Site 04</span><strong>{siteKm === null ? '—' : formatKm(siteKm)}</strong></div>
          </div>
          {outsideMap && <p className="planning-hint">El punto queda fuera de este radio. Amplía el mapa para verlo.</p>}
        </div>
      </div>
      <div className="planning-coordinate-grid">
        <label className="planning-label">
          Latitud planetocéntrica (°)
          <input type="number" min="-90" max="90" step="0.0001" value={form.latitude} onChange={(event) => updateCoordinate('latitude', event.target.value)} disabled={form.site !== 'custom'} aria-describedby="site-coordinate-status" aria-invalid={!coordinatesValid} />
        </label>
        <label className="planning-label">
          Longitud este (°)
          <input type="number" min="0" max="360" step="0.0001" value={form.longitude} onChange={(event) => updateCoordinate('longitude', event.target.value)} disabled={form.site !== 'custom'} aria-describedby="site-coordinate-status" aria-invalid={!coordinatesValid} />
        </label>
      </div>
      <p className="site-coordinate-status" id="site-coordinate-status" role="status">
        {form.site === 'custom'
          ? 'Coordenadas personalizadas.'
          : 'Coordenadas de referencia para Shackleton · Site 04.'}
      </p>
      <div className="planning-form-grid site-constraints">
        <label className="planning-label">
          Altitud sobre el radio lunar medio (m)
          <input type="number" step="1" value={form.elevation} onChange={(event) => update('elevation', event.target.value)} aria-invalid={!altitudeValid} />
        </label>
        <span />
        <GlyphTiles label="Área de aterrizaje" options={['Radio de 100 m', 'Radio de 500 m', 'Radio de 1 km']} value={form.landingArea} onChange={(value) => update('landingArea', value)} Glyph={AreaGlyph} />
        <GlyphTiles label="Pendiente máxima admitida" options={['5°', '10°', '15°']} value={form.maxSlope} onChange={(value) => update('maxSlope', value)} Glyph={SlopeGlyph} />
      </div>
      <p className={`planning-hint ${siteInputsValid ? '' : 'planning-error'}`}>
        {siteInputsValid ? 'Marco planetocéntrico ME · evalúa el área y la pendiente antes de comparar la visibilidad.' : 'Ingresa una latitud válida, longitud este de 0° a 360° y altitud numérica.'}
      </p>
      <p className="planning-note">Shackleton es una referencia cartográfica, no un sitio aprobado. Área y pendiente son parámetros del escenario, no límites universales NASA. El mapa usa una proyección polar simplificada.</p>
    </section>
  )
}

export function CrewStep({ form, update }) {
  return (
    <section aria-labelledby="crew-step-title">
      <h2 id="crew-step-title">Tripulación y <em>soporte vital</em></h2>
      <p className="planning-intro">Este paso solo se agrega a las misiones tripuladas. Para una misión robótica se omiten estos requisitos.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Tamaño de la tripulación" options={['2 personas', '3 personas', '4 personas']} value={form.crewSize} onChange={(value) => update('crewSize', value)} />
        <ChoiceGroup label="Plan de actividad extravehicular (EVA)" options={['Sin caminatas', '1 caminata', '2 o más caminatas']} value={form.evaPlan} onChange={(value) => update('evaPlan', value)} />
        <ChoiceGroup label="Soporte vital" options={['Integrado', 'Redundancia parcial', 'Redundancia completa']} value={form.lifeSupport} onChange={(value) => update('lifeSupport', value)} />
        <ChoiceGroup label="Control ambiental del hábitat" options={['Temperatura', 'Temperatura y presión', 'Sistema completo']} value={form.habitatControl} onChange={(value) => update('habitatControl', value)} />
      </div>
      <div className="mission-plan-preview">
        <strong>Requisitos incluidos</strong>
        <span>El módulo habitable, el oxígeno, el agua, la presión y los trajes para EVA forman parte de esta misión.</span>
      </div>
    </section>
  )
}

export function LogisticsStep({ form, update }) {
  return (
    <section aria-labelledby="logistics-step-title">
      <h2 id="logistics-step-title">Logística de <em>larga duración</em></h2>
      <p className="planning-intro">Solo aparece para una misión tripulada de larga duración.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Suministros de reserva" options={['30 días', '60 días', '90 días']} value={form.supplies} onChange={(value) => update('supplies', value)} />
        <ChoiceGroup label="Redundancia energética" options={['Simple', 'Doble', 'Triple']} value={form.redundancy} onChange={(value) => update('redundancy', value)} />
        <ChoiceGroup label="Uso de recursos lunares (ISRU)" options={['Sin uso local', 'Evaluación', 'Producción local']} value={form.isru} onChange={(value) => update('isru', value)} />
      </div>
      <div className="mission-plan-preview">
        <strong>Se omite en estancias cortas</strong>
        <span>La reserva prolongada, la redundancia energética y el uso de recursos locales se agregan por la duración seleccionada.</span>
      </div>
    </section>
  )
}

export function SampleStep({ form, update }) {
  return (
    <section aria-labelledby="sample-step-title">
      <h2 id="sample-step-title">Retorno de <em>muestras</em></h2>
      <p className="planning-intro">Este paso solo se incluye cuando la misión debe traer material lunar de vuelta a la Tierra.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Material objetivo" options={['Hielo de agua', 'Regolito', 'Rocas lunares']} value={form.sampleTarget} onChange={(value) => update('sampleTarget', value)} />
        <ChoiceGroup label="Sistema de recolección" options={['Brazo robótico', 'Rover recolector', 'Taladro y contenedor']} value={form.sampleCollection} onChange={(value) => update('sampleCollection', value)} />
        <ChoiceGroup label="Sistema de retorno" options={['Cápsula de retorno', 'Vehículo de ascenso y cápsula']} value={form.sampleReturn} onChange={(value) => update('sampleReturn', value)} />
      </div>
      <div className="mission-plan-preview">
        <strong>Requisitos incluidos</strong>
        <span>El plan reserva espacio para almacenamiento, ascenso desde la Luna y recuperación de la cápsula.</span>
      </div>
    </section>
  )
}

export function ForecastStep({ samples, loading, error }) {
  const solarHours = samples?.filter((sample) => sample.sun.state === 'visible').length
  const earthHours = samples?.filter((sample) => sample.earth.state === 'visible').length
  const terrainKnown = samples?.[0]?.horizonBasis === 'terrain'
  return (
    <section aria-labelledby="forecast-title">
      <h2 id="forecast-title">Luz y <em>visibilidad</em></h2>
      <p className="planning-intro">Muestras horarias del día seleccionado para la ubicación elegida.</p>
      {loading && <p className="forecast-time" role="status">Calculando posiciones del Sol y la Tierra...</p>}
      {error && <p className="planning-error" role="alert">{error}</p>}
      {!loading && !error && samples?.length > 0 && <>
        <div className="forecast-grid">
          <article className="forecast-card"><span>Sol visible sobre el relieve</span><strong>{solarHours} de {samples.length} muestras</strong><small>Estimación horaria de iluminación directa</small></article>
          <article className="forecast-card"><span>Tierra visible sobre el relieve</span><strong>{earthHours} de {samples.length} muestras</strong><small>Indicador geométrico; no confirma un enlace de comunicaciones</small></article>
        </div>
        {!terrainKnown && <p className="forecast-warning">No hay cobertura LOLA para este punto. Los resultados indican visibilidad sobre el horizonte geom?trico; el relieve es indeterminado.</p>}
        <p className="planning-hint">Conteo de muestras horarias, no una predicción continua ni una garantía de energía o comunicaciones.</p>
      </>}
      {!loading && !error && !samples?.length && <p className="forecast-time">No hay muestras disponibles para este d?a.</p>}
    </section>
  )
}

export function SummaryStep({ form, missionProfile, isModeledSite, selectedSample, visibilityError, downloadPlan }) {
  return (
    <section className="summary-step" aria-labelledby="planning-title">
      <h2 id="planning-title">Resumen de <em>misión</em></h2>
      <p className="planning-intro">Revisa la configuración y descarga el plan.</p>
      <div className="summary-card">
        <div className="summary-hero">
          <img className="summary-mission-photo" src={missionProfile.photo} alt={missionProfile.label} />
          <div className="summary-heading"><div><span>PLAN DE MISIÓN</span><strong>{form.name || 'Misión sin nombre'}</strong></div></div>
        </div>
        <dl className="summary-list">
          <div><dt>Perfil</dt><dd>{missionProfile.label}</dd></div>
          <div><dt>Objetivo</dt><dd>{form.objective} · {form.duration}</dd></div>
          <div><dt>Lanzador y carga</dt><dd>{form.vehicle || 'Sin definir'} · {form.mass ? `${form.mass} kg` : 'Masa no definida'} · {form.payload}</dd></div>
          <div><dt>Lanzamiento</dt><dd>{form.launchSite} · {form.launchWindow}</dd></div>
          <div><dt>Sitio</dt><dd>{isModeledSite ? visibilitySite.name : 'Coordenadas personalizadas'}</dd></div>
          <div><dt>Área y pendiente</dt><dd>{form.landingArea} · {form.maxSlope}</dd></div>
          <div><dt>Altitud</dt><dd>{form.elevation} m sobre el radio lunar medio</dd></div>
          <div><dt>Coordenadas</dt><dd>{Number(form.latitude).toFixed(4)}° · {Number(form.longitude).toFixed(4)}° E</dd></div>
          <div><dt>Aterrizaje (UTC)</dt><dd>{form.dateTime.replace('T', ' · ')} UT</dd></div>
          {missionProfile.conditionalSteps.includes('crew') && (
            <div><dt>Tripulacion y soporte</dt><dd>{form.crewSize} ? {form.evaPlan} ? {form.lifeSupport}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('logistics') && (
            <div><dt>Logistica</dt><dd>{form.supplies} de reserva ? energia {form.redundancy} ? ISRU {form.isru}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('sample') && (
            <div><dt>Retorno de muestras</dt><dd>{form.sampleTarget} ? {form.sampleCollection} ? {form.sampleReturn}</dd></div>
          )}
        </dl>
        {selectedSample && (
          <div className="summary-visibility">
            <span>Sol {selectedSample.sun.state === 'visible' ? 'visible' : 'oculto'} <b>{formatAngle(selectedSample.sun.elevation)}</b></span>
            <span>Tierra {selectedSample.earth.state === 'visible' ? 'visible' : 'oculta'} <b>{formatAngle(selectedSample.earth.elevation)}</b></span>
          </div>
        )}
        {isModeledSite && visibilityError && (
          <p className="planning-error summary-data-note" role="alert">{visibilityError}</p>
        )}
        {!isModeledSite && !selectedSample && (
          <p className="summary-data-note" role={visibilityError ? 'alert' : undefined}>{visibilityError || 'No hay cálculo de visibilidad para las coordenadas personalizadas.'}</p>
        )}
        {!isModeledSite && selectedSample?.horizonBasis === 'geometric' && (
          <p className="summary-data-note">La cobertura LOLA es indeterminada en este sitio; los estados solo usan el horizonte geométrico.</p>
        )}
      </div>
      <button className="download-plan-button" type="button" onClick={downloadPlan}>
        Descargar plan
      </button>
    </section>
  )
}
