import { ArrowRight, Check, Download, Earth, MapPin, Rocket, Sun } from 'lucide-react'
import visibilitySite from '../../../Data_Structure/data/visibility-site.json'
import { dateTimeMax, dateTimeMin, formatAngle } from './PlanningVisibility'

// --- Datos del formulario ---
export const missionTypes = [
  {
    id: 'robotic',
    maxDays: 90,
    letter: 'A',
    photo: 'src/foto1.jpeg',
    label: 'Misión robótica no tripulada',
    description: 'Un aterrizador o rover opera de forma autónoma en el polo sur, sin tripulación a bordo. Navega, toma mediciones y envía datos a la Tierra de forma continua. Es la opción más económica y de menor riesgo para explorar zonas de sombra permanente y estudiar el hielo o el terreno.',
    objectives: ['Estudio de hielo', 'Mapeo del terreno', 'Experimentos científicos'],
    durations: ['7 días', '30 días', '90 días'],
    vehicles: ['Clase ligera', 'Clase media', 'Clase pesada'],
    masses: ['Menos de 2 t', '2 a 10 t', 'Más de 10 t'],
    payloads: ['Instrumentos', 'Rover e instrumentos'],
    conditionalSteps: [],
    requirements: ['Navegación autónoma', 'Energía para operar', 'Sin soporte vital'],
    excluded: ['Seguridad de tripulación', 'Retorno de muestras'],
  },
  {
    id: 'crewed-short',
    maxDays: 14,
    letter: 'B',
    photo: 'src/foto2.jpeg',
    label: 'Misión tripulada de corta duración',
    description: 'Una tripulación aterriza, explora la superficie durante una estancia breve y regresa. Incluye un módulo habitable, trajes para actividad extravehicular y soporte vital para pocos días. Permite hacer trabajo científico directo con menor exposición y menor consumo de recursos.',
    objectives: ['Estudio de hielo', 'Mapeo del terreno', 'Recolección de muestras'],
    durations: ['7 días', '14 días'],
    vehicles: ['Clase media', 'Clase pesada', 'Súper pesado'],
    masses: ['2 a 10 t', 'Más de 10 t'],
    payloads: ['Módulo habitado', 'Módulo habitado y rover'],
    conditionalSteps: ['crew'],
    requirements: ['Soporte vital', 'Trajes para EVA', 'Seguridad de la tripulación'],
    excluded: ['Logística de larga duración', 'Retorno automatizado de muestras'],
  },
  {
    id: 'crewed-long',
    maxDays: 90,
    letter: 'C',
    photo: 'src/foto3.jpeg',
    label: 'Misión tripulada de larga duración',
    description: 'Una tripulación mantiene una presencia prolongada en la superficie, con un hábitat estable y rutinas de trabajo. Requiere suministros y energía redundantes, protección contra la radiación y, si es posible, aprovechar recursos lunares. Es la misión más compleja y la que más prepara el camino para una base permanente.',
    objectives: ['Estudio de hielo', 'Mapeo del terreno', 'Uso de recursos lunares'],
    durations: ['30 días', '90 días'],
    vehicles: ['Clase pesada', 'Súper pesado'],
    masses: ['Más de 10 t'],
    payloads: ['Módulo habitado', 'Base y rover'],
    conditionalSteps: ['crew', 'logistics'],
    requirements: ['Soporte vital', 'Suministros y energía redundantes', 'Protección radiológica'],
    excluded: ['Retorno automatizado de muestras'],
  },
  {
    id: 'sample-return',
    maxDays: 30,
    letter: 'D',
    photo: 'src/foto4.jpeg',
    label: 'Misión robótica con retorno de muestras',
    description: 'Un sistema robótico recolecta material lunar, como hielo, regolito o roca, y lo almacena. Después un vehículo de ascenso lo saca de la Luna y una cápsula lo devuelve a la Tierra. Permite analizar las muestras en laboratorio sin enviar personas.',
    objectives: ['Muestras de hielo', 'Muestras del regolito', 'Muestras de roca'],
    durations: ['7 días', '30 días'],
    vehicles: ['Clase media', 'Clase pesada', 'Súper pesado'],
    masses: ['2 a 10 t', 'Más de 10 t'],
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
  vehicle: 'Clase media',
  mass: 'Menos de 2 t',
  launchSite: 'Cabo Cañaveral',
  payload: 'Instrumentos',
  propulsion: 'Química',
  launchWindow: 'Noviembre 2026',
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
  environment: {
    sunlight: 'Casi continua',
    temperature: 'Moderada',
    communication: 'Directa con la Tierra',
    radiation: 'Protección básica',
    micrometeorites: 'Sin protección extra',
    terrain: 'Regolito fino',
  },
  risk: {
    asteroidMonitoring: 'Monitoreo básico',
    orbitalUncertainty: 'Baja',
    collisionRisk: 'Bajo',
    communicationAvailability: 'Siempre',
    emergencyManeuvers: 'Parcial',
  },
}

// --- Duración: días libres con tope según el tipo de misión ---
export const formatDays = (days) => `${days} ${Number(days) === 1 ? 'día' : 'días'}`

export function getDurationIssue(form, missionProfile) {
  const raw = String(form.durationDays ?? '').trim()
  const days = Number(raw)
  if (raw === '' || !Number.isFinite(days)) return 'Escribe cuántos días durará la misión.'
  if (!Number.isInteger(days) || days < 1) return 'La duración debe ser un número entero de días, de 1 en adelante.'
  if (days > missionProfile.maxDays) {
    return `${missionProfile.label} admite como máximo ${formatDays(missionProfile.maxDays)}. Reduce la duración para continuar.`
  }
  return ''
}

// --- Ventanas de lanzamiento: solo los meses dentro del intervalo de datos ---
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const launchWindowOptions = (() => {
  const start = new Date(`${dateTimeMin}:00Z`)
  const end = new Date(`${dateTimeMax}:00Z`)
  const options = []
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth()
  while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
    options.push(`${monthNames[month]} ${year}`)
    month += 1
    if (month > 11) { month = 0; year += 1 }
  }
  return options
})()

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
// --- Pasos del asistente ---
export function MissionStep({ form, missionProfile, update, selectMissionType }) {
  const durationIssue = getDurationIssue(form, missionProfile)
  const setDuration = (days) => {
    update('durationDays', days)
    update('duration', days.trim() === '' ? '' : formatDays(days))
  }
  return (
    <section aria-labelledby="planning-title">
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
                <span>{type.photo}</span>
                <img src={`/${type.photo}`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
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
            max={missionProfile.maxDays}
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
            {durationIssue || `Máximo recomendado para esta misión: ${formatDays(missionProfile.maxDays)}.`}
          </p>
        </fieldset>
      </div>
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
      <div className="planning-form-grid">
        <ChoiceGroup
          label="Vehículo de lanzamiento"
          options={missionProfile.vehicles}
          value={form.vehicle}
          onChange={(value) => update('vehicle', value)}
        />
        <ChoiceGroup
          label="Masa total"
          options={missionProfile.masses}
          value={form.mass}
          onChange={(value) => update('mass', value)}
        />
        <ChoiceGroup label="Lugar de lanzamiento" options={['Cabo Cañaveral', 'Kourou', 'Sriharikota']} value={form.launchSite} onChange={(value) => update('launchSite', value)} />
        <ChoiceGroup label="Carga útil" options={missionProfile.payloads} value={form.payload} onChange={(value) => update('payload', value)} />
        <ChoiceGroup label="Sistema de propulsión" options={['Química', 'Eléctrica', 'Híbrida']} value={form.propulsion} onChange={(value) => update('propulsion', value)} />
        <label className="planning-label planning-select-shell">
          Ventana de lanzamiento
          <select value={form.launchWindow} onChange={(event) => update('launchWindow', event.target.value)}>
            {launchWindowOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mission-plan-preview">
        {missionProfile.id === 'crewed-long'
          ? 'Se prioriza un vehículo pesado para transportar soporte vital y suministros.'
          : missionProfile.id === 'sample-return'
            ? 'La carga útil contempla equipo de recolección y retorno de muestras.'
            : missionProfile.id === 'crewed-short'
              ? 'La carga útil debe incluir un módulo habitable y equipo para actividad extravehicular.'
              : 'El plan robótico no incluye masa ni sistemas de soporte vital para tripulación.'}
      </p>
    </section>
  )
}

export function SiteStep({ form, update, updateCoordinate, coordinatesValid, altitudeValid, siteInputsValid }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Sitio de <em>aterrizaje</em></h2>
      <p className="planning-intro">Selecciona el sitio con datos de visibilidad LOLA o ingresa unas coordenadas para evaluar otro punto.</p>
      <div className="site-option-grid">
        <button className={`site-option ${form.site === 'site04' ? 'is-selected' : ''}`} type="button" aria-pressed={form.site === 'site04'} onClick={() => {
          update('site', 'site04')
          updateCoordinate('latitude', String(visibilitySite.latitude_deg))
          updateCoordinate('longitude', String(visibilitySite.longitude_east_deg))
        }}>
          <span className="site-option-icon"><MapPin size={18} /></span>
          <strong>Shackleton · Site 04</strong>
          <small>Centro documentado · borde del cráter</small>
          <code>{visibilitySite.latitude_deg}° · {visibilitySite.longitude_east_deg}° E</code>
          <span className="site-data-badge"><Check size={12} /> Modelo LOLA disponible</span>
        </button>
        <button className={`site-option ${form.site === 'custom' ? 'is-selected' : ''}`} type="button" aria-pressed={form.site === 'custom'} onClick={() => update('site', 'custom')}>
          <span className="site-option-icon"><MapPin size={18} /></span>
          <strong>Coordenadas propias</strong>
          <small>Define un punto lunar para tu escenario.</small>
          <span className="site-custom-note">La visibilidad no se calcula sin datos de terreno y efemérides.</span>
        </button>
      </div>
      <div className="planning-coordinate-grid">
        <label className="planning-label">
          Latitud planetocéntrica (°)
          <input type="number" min="-90" max="90" step="0.0001" value={form.latitude} onChange={(event) => updateCoordinate('latitude', event.target.value)} aria-invalid={!coordinatesValid} />
        </label>
        <label className="planning-label">
          Longitud este (°)
          <input type="number" min="0" max="360" step="0.0001" value={form.longitude} onChange={(event) => updateCoordinate('longitude', event.target.value)} aria-invalid={!coordinatesValid} />
        </label>
      </div>
      <div className="planning-form-grid site-constraints">
        <label className="planning-label">
          Altitud sobre el radio lunar medio (m)
          <input type="number" step="1" value={form.elevation} onChange={(event) => update('elevation', event.target.value)} aria-invalid={!altitudeValid} />
        </label>
        <ChoiceGroup
          label="Área de aterrizaje"
          options={['Radio de 100 m', 'Radio de 500 m', 'Radio de 1 km']}
          value={form.landingArea}
          onChange={(value) => update('landingArea', value)}
        />
        <ChoiceGroup
          label="Pendiente máxima admitida"
          options={['5°', '10°', '15°']}
          value={form.maxSlope}
          onChange={(value) => update('maxSlope', value)}
        />
      </div>
      <p className={`planning-hint ${siteInputsValid ? '' : 'planning-error'}`}>
        {siteInputsValid ? 'Marco planetocéntrico ME · evalúa el área y la pendiente antes de comparar la visibilidad.' : 'Ingresa una latitud válida, longitud este de 0° a 360° y altitud numérica.'}
      </p>
    </section>
  )
}

export function CrewStep({ form, update }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Tripulación y <em>soporte vital</em></h2>
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
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Logística de <em>larga duración</em></h2>
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
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Retorno de <em>muestras</em></h2>
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

export function EnvironmentStep({ form, update }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Condiciones <em>ambientales</em></h2>
      <p className="planning-intro">Selecciona las condiciones que el sitio y el diseño deben soportar. La visibilidad calculada se muestra en el siguiente paso.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Iluminación solar" options={['Casi continua', 'Intermitente', 'Sombra permanente']} value={form.environment.sunlight} onChange={(value) => update('environment', { ...form.environment, sunlight: value })} />
        <ChoiceGroup label="Temperatura" options={['Moderada', 'Fría', 'Extrema']} value={form.environment.temperature} onChange={(value) => update('environment', { ...form.environment, temperature: value })} />
        <ChoiceGroup label="Comunicación" options={['Directa con la Tierra', 'Vía orbitador de relevo', 'Intermitente']} value={form.environment.communication} onChange={(value) => update('environment', { ...form.environment, communication: value })} />
        <ChoiceGroup label="Radiación" options={['Protección básica', 'Blindaje reforzado', 'Refugio dedicado']} value={form.environment.radiation} onChange={(value) => update('environment', { ...form.environment, radiation: value })} />
        <ChoiceGroup label="Micrometeoritos" options={['Sin protección extra', 'Escudo estándar', 'Escudo reforzado']} value={form.environment.micrometeorites} onChange={(value) => update('environment', { ...form.environment, micrometeorites: value })} />
        <ChoiceGroup label="Condiciones del terreno" options={['Regolito fino', 'Rocoso', 'Mixto']} value={form.environment.terrain} onChange={(value) => update('environment', { ...form.environment, terrain: value })} />
      </div>
      <div className="planning-callout">
        <span className="live-dot" />
        <p>La elevación y el azimut de la Tierra determinan la visibilidad y orientación de antenas; las ventanas se comparan con el horizonte local en el análisis de visibilidad.</p>
      </div>
    </section>
  )
}

export function RiskStep({ form, update, missionProfile }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Riesgos y <em>seguridad</em></h2>
      <p className="planning-intro">Ajusta los factores operativos para identificar qué soporte requerirá esta misión.</p>
      <div className="planning-form-grid">
        <ChoiceGroup label="Encuentros con asteroides" options={['Monitoreo básico', 'Monitoreo continuo', 'Maniobra de evasión']} value={form.risk.asteroidMonitoring} onChange={(value) => update('risk', { ...form.risk, asteroidMonitoring: value })} />
        <ChoiceGroup label="Incertidumbre orbital" options={['Baja', 'Media', 'Alta']} value={form.risk.orbitalUncertainty} onChange={(value) => update('risk', { ...form.risk, orbitalUncertainty: value })} />
        <ChoiceGroup label="Riesgo de colisión" options={['Bajo', 'Moderado', 'Alto']} value={form.risk.collisionRisk} onChange={(value) => update('risk', { ...form.risk, collisionRisk: value })} />
        <ChoiceGroup label="Disponibilidad de comunicaciones" options={['Siempre', 'Ventanas programadas', 'Intermitente']} value={form.risk.communicationAvailability} onChange={(value) => update('risk', { ...form.risk, communicationAvailability: value })} />
        <ChoiceGroup label="Capacidad de maniobras de emergencia" options={['Sin capacidad', 'Parcial', 'Completa']} value={form.risk.emergencyManeuvers} onChange={(value) => update('risk', { ...form.risk, emergencyManeuvers: value })} />
      </div>
      {missionProfile.id === 'crewed-long' && (
        <p className="mission-plan-preview">Por ser una misión tripulada prolongada, se conserva la protección radiológica, la redundancia energética y la capacidad de contingencia elegidas.</p>
      )}
    </section>
  )
}

export function SummaryStep({ form, missionProfile, isModeledSite, selectedSample, visibilityError, downloaded, downloadPlan }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Resumen de <em>misión</em></h2>
      <p className="planning-intro">Revisa la configuración y descarga una ficha JSON para compartir el escenario.</p>
      <div className="summary-card">
        <div className="summary-heading"><Rocket size={18} /><div><span>PLAN DE MISIÓN</span><strong>{form.name || 'Misión sin nombre'}</strong></div></div>
        <dl className="summary-list">
          <div><dt>Perfil</dt><dd>{missionProfile.label}</dd></div>
          <div><dt>Objetivo</dt><dd>{form.objective} · {form.duration}</dd></div>
          <div><dt>Vehículo y carga</dt><dd>{form.vehicle} · {form.mass} · {form.payload}</dd></div>
          <div><dt>Lanzamiento</dt><dd>{form.launchSite} · {form.launchWindow}</dd></div>
          <div><dt>Sitio</dt><dd>{isModeledSite ? visibilitySite.name : 'Coordenadas personalizadas'}</dd></div>
          <div><dt>Área y pendiente</dt><dd>{form.landingArea} · {form.maxSlope}</dd></div>
          <div><dt>Altitud</dt><dd>{form.elevation} m sobre el radio lunar medio</dd></div>
          <div><dt>Coordenadas</dt><dd>{Number(form.latitude).toFixed(4)}° · {Number(form.longitude).toFixed(4)}° E</dd></div>
          <div><dt>Aterrizaje (UTC)</dt><dd>{form.dateTime.replace('T', ' · ')} UT</dd></div>
          {missionProfile.conditionalSteps.includes('crew') && (
            <div><dt>Tripulación y soporte</dt><dd>{form.crewSize} · {form.evaPlan} · {form.lifeSupport}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('logistics') && (
            <div><dt>Logística</dt><dd>{form.supplies} de reserva · energía {form.redundancy} · ISRU {form.isru}</dd></div>
          )}
          {missionProfile.conditionalSteps.includes('sample') && (
            <div><dt>Retorno de muestras</dt><dd>{form.sampleTarget} · {form.sampleCollection} · {form.sampleReturn}</dd></div>
          )}
        </dl>
        {selectedSample && (
          <div className="summary-visibility">
            <span><Sun size={14} /> Sol {selectedSample.sun.state === 'visible' ? 'visible' : 'oculto'} <b>{formatAngle(selectedSample.sun.elevation)}</b></span>
            <span><Earth size={14} /> Tierra {selectedSample.earth.state === 'visible' ? 'visible' : 'oculta'} <b>{formatAngle(selectedSample.earth.elevation)}</b></span>
          </div>
        )}
        {isModeledSite && visibilityError && (
          <p className="planning-error summary-data-note" role="alert">{visibilityError}</p>
        )}
        {!isModeledSite && (
          <p className="summary-data-note">No hay cálculo de visibilidad para las coordenadas personalizadas.</p>
        )}
      </div>
      <button className="download-plan-button" type="button" onClick={downloadPlan}>
        {downloaded ? <Check size={16} /> : <Download size={16} />}
        {downloaded ? 'Plan descargado' : 'Descargar plan JSON'}
        <ArrowRight size={15} />
      </button>
      {downloaded && <p className="download-confirmation" role="status">Se descargó plan-lunar.json con los datos del escenario.</p>}
    </section>
  )
}