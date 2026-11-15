import { Check, MapPin } from 'lucide-react'
import visibilitySite from '../../../Data_Structure/data/visibility-site.json'
import { formatAngle } from './PlanningVisibility'

// --- Datos del formulario ---
export const missionTypes = [
  {
    id: 'robotic',
    letter: 'A',
    photo: 'src/foto1.jpeg',
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
    photo: 'src/foto2.jpeg',
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
    photo: 'src/foto3.jpeg',
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
    photo: 'src/foto4.jpeg',
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
  const activity = ['Baja', 'Moderada', 'Elevada']

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
    terrain_assessment: 'Pendiente y obstáculos sin evaluar',
  }
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
// --- Pasos del asistente ---
export function MissionStep({ form, missionProfile, update, selectMissionType }) {
  const durationIssue = getDurationIssue(form)
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
        <ChoiceGroup label="Sistema de propulsión" options={['Química', 'Eléctrica', 'Híbrida']} value={form.propulsion} onChange={(value) => update('propulsion', value)} />
        <label className="planning-label">
          Ventana de lanzamiento (referencia)
          <input value={form.launchWindow} placeholder="No definida" onChange={(event) => update('launchWindow', event.target.value)} />
        </label>
      </div>
      <p className="planning-note">Antecedentes NASA históricos; no indican disponibilidad. Masa, ventana, carga y propulsión no se validan aquí.</p>
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
          <small>Referencia cartográfica; sus coordenadas están establecidas y bloqueadas.</small>
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
      <p className="planning-note">Site 04 es una referencia cartográfica, no un sitio aprobado. Área y pendiente son parámetros del escenario, no límites universales NASA.</p>
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

export function ForecastStep({ forecast }) {
  if (!forecast) {
    return (
      <section aria-labelledby="forecast-title">
        <h2 id="forecast-title">Pronóstico de <em>entorno</em></h2>
        <p className="planning-intro">Selecciona una fecha y hora para ver la simulación.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="forecast-title">
      <h2 id="forecast-title">Entorno y <em>riesgos</em></h2>
      <p className="planning-intro">Vista previa automática para la fecha seleccionada.</p>
      <p className="forecast-time">Escenario: {forecast.selected_at_utc.replace('T', ' · ').replace(':00Z', ' UT')}</p>
      <div className="forecast-warning" role="note">
        <strong>SIMULACIÓN · DATOS FICTICIOS</strong>
        <span>No es un pronóstico real. La Luna no tiene clima como la Tierra; estos valores solo muestran la futura experiencia del backend.</span>
      </div>
      <div className="forecast-grid">
        <article className="forecast-card">
          <span>Iluminación simulada</span>
          <strong>{forecast.illumination_hours} h</strong>
          <small>de luz en 24 h</small>
        </article>
        <article className="forecast-card">
          <span>Temperatura superficial</span>
          <strong>{forecast.surface_temperature_c.minimum}° a {forecast.surface_temperature_c.maximum}°C</strong>
          <small>rango ilustrativo</small>
        </article>
        <article className="forecast-card">
          <span>Radiación · índice demo</span>
          <strong>{forecast.radiation_index_demo} / 5</strong>
          <small>sin dosis ni evaluación de protección</small>
        </article>
        <article className="forecast-card">
          <span>Micrometeoroides</span>
          <strong>Actividad {forecast.micrometeoroid_activity_demo.toLowerCase()}</strong>
          <small>sin probabilidad de impacto calculada</small>
        </article>
        <article className="forecast-card">
          <span>Comunicaciones simuladas</span>
          <strong>{forecast.communication_windows_demo} ventanas</strong>
          <small>{forecast.communication_hours_demo} h · sin validar enlace</small>
        </article>
        <article className="forecast-card">
          <span>Terreno y aterrizaje</span>
          <strong>{forecast.terrain_assessment}</strong>
          <small>requiere datos topográficos del sitio</small>
        </article>
      </div>
      <p className="planning-note">La simulación cambia con fecha y coordenadas. Riesgos reales requieren modelos y datos NASA/backend.</p>
    </section>
  )
}

export function SummaryStep({ form, missionProfile, isModeledSite, selectedSample, visibilityError, demoForecast, downloadPlan }) {
  return (
    <section aria-labelledby="planning-title">
      <h2 id="planning-title">Resumen de <em>misión</em></h2>
      <p className="planning-intro">Revisa la configuración y descarga el plan.</p>
      <div className="summary-card">
        <div className="summary-heading"><div><span>PLAN DE MISIÓN</span><strong>{form.name || 'Misión sin nombre'}</strong></div></div>
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
          {demoForecast && (
            <div><dt>Entorno / riesgos</dt><dd>Simulación ficticia · {demoForecast.illumination_hours} h de luz · micrometeoroides {demoForecast.micrometeoroid_activity_demo.toLowerCase()}</dd></div>
          )}
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
            <span>Sol {selectedSample.sun.state === 'visible' ? 'visible' : 'oculto'} <b>{formatAngle(selectedSample.sun.elevation)}</b></span>
            <span>Tierra {selectedSample.earth.state === 'visible' ? 'visible' : 'oculta'} <b>{formatAngle(selectedSample.earth.elevation)}</b></span>
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
        Descargar plan
      </button>
    </section>
  )
}