import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Earth,
  Info,
  MapPin,
  Moon,
  Rocket,
  Sun,
} from 'lucide-react'
import visibilityCsvUrl from '../../../Data_Structure/data/visibility/visibility.csv?url'
import visibilitySite from '../../../Data_Structure/data/visibility-site.json'
import '../../estilos/planificacion/PlanningPanel.css'

const missionTypes = [
  {
    id: 'robotic',
    letter: 'A',
    label: 'Misión robótica no tripulada',
    description: 'Un aterrizador o rover opera de forma autónoma en el polo sur.',
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
    letter: 'B',
    label: 'Misión tripulada de corta duración',
    description: 'Una tripulación explora la superficie durante una estancia breve.',
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
    letter: 'C',
    label: 'Misión tripulada de larga duración',
    description: 'Una tripulación mantiene una presencia prolongada en la superficie.',
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
    letter: 'D',
    label: 'Misión robótica con retorno de muestras',
    description: 'Recolecta material lunar, lo almacena y lo devuelve a la Tierra.',
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
const dateTimeMin = '2026-11-14T00:00'
const dateTimeMax = '2027-02-12T00:00'
let visibilitySamplesPromise
const initialForm = {
  name: 'Misión polar 01',
  missionType: 'robotic',
  objective: 'Estudio de hielo',
  duration: '7 días',
  vehicle: 'Clase media',
  mass: 'Menos de 2 t',
  launchSite: 'Cabo Cañaveral',
  payload: 'Instrumentos',
  propulsion: 'Química',
  launchWindow: 'Nov 2026',
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

function parseVisibilityCsv(csv) {
  const visibilityByTime = new Map()
  csv.trim().split(/\r?\n/).slice(1).forEach((line) => {
    const [time, object, azimuth, elevation, terrain, difference, state] = line.split(',')
    const sampleTime = Date.parse(time)
    const sample = visibilityByTime.get(sampleTime) ?? { time: sampleTime }
    sample[object] = {
      azimuth: Number(azimuth),
      elevation: Number(elevation),
      terrain: Number(terrain),
      difference: Number(difference),
      state,
    }
    visibilityByTime.set(sampleTime, sample)
  })
  const samples = [...visibilityByTime.values()].sort((a, b) => a.time - b.time)
  if (!samples.length || samples.some((sample) => !sample.sun || !sample.earth)) {
    throw new Error('El CSV no contiene muestras válidas para el Sol y la Tierra.')
  }
  return samples
}

function loadVisibilitySamples() {
  if (!visibilitySamplesPromise) {
    visibilitySamplesPromise = fetch(visibilityCsvUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.text()
      })
      .then(parseVisibilityCsv)
      .catch((error) => {
        visibilitySamplesPromise = null
        throw error
      })
  }
  return visibilitySamplesPromise
}

function getNearestSample(samples, dateTime) {
  const targetTime = Date.parse(`${dateTime}:00Z`)
  if (!Number.isFinite(targetTime) || !samples) return null

  let nearest = null
  for (const sample of samples) {
    if (!nearest || Math.abs(sample.time - targetTime) < Math.abs(nearest.time - targetTime)) {
      nearest = sample
    }
    if (sample.time > targetTime && nearest && sample.time - targetTime > targetTime - nearest.time) break
  }
  return nearest
}

function getDaySamples(samples, date) {
  return (samples ?? []).filter((sample) =>
    new Date(sample.time).toISOString().startsWith(`${date}T`),
  )
}

function formatUtcDate(timestamp) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(timestamp)
}

function formatUtcTime(timestamp) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(timestamp)
}

function formatAngle(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}°`
}

function ChoiceGroup({ label, options, value, onChange }) {
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

function SkyDiagram({ sample }) {
  const objects = [
    { key: 'sun', label: 'Sol' },
    { key: 'earth', label: 'Tierra' },
  ]
  const center = 110
  const horizonRadius = 73
  const pointAt = (azimuth, elevation) => {
    const radius = horizonRadius * (90 - Math.max(-32, Math.min(90, elevation))) / 90
    const angle = (azimuth - 90) * Math.PI / 180
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  }

  return (
    <svg
      className="sky-diagram"
      viewBox="0 0 220 220"
      role="img"
      aria-label={`Posición del Sol a ${formatAngle(sample.sun.elevation)} y de la Tierra a ${formatAngle(sample.earth.elevation)} respecto al horizonte`}
    >
      <circle className="sky-grid" cx={center} cy={center} r="36" />
      <circle className="sky-grid" cx={center} cy={center} r="55" />
      <circle className="sky-horizon" cx={center} cy={center} r={horizonRadius} />
      <line className="sky-axis" x1={center} y1="27" x2={center} y2="193" />
      <line className="sky-axis" x1="27" y1={center} x2="193" y2={center} />
      <text className="sky-cardinal" x={center} y="16" textAnchor="middle">N</text>
      <text className="sky-cardinal" x="207" y={center + 3} textAnchor="middle">E</text>
      <text className="sky-cardinal" x={center} y="215" textAnchor="middle">S</text>
      <text className="sky-cardinal" x="13" y={center + 3} textAnchor="middle">O</text>
      {objects.map(({ key, label }) => {
        const body = sample[key]
        const position = pointAt(body.azimuth, body.elevation)
        const terrainStart = pointAt(body.azimuth, body.terrain - 3)
        const terrainEnd = pointAt(body.azimuth, body.terrain + 3)
        return (
          <g key={key} className={`sky-object sky-object-${key}`}>
            <line
              className="sky-terrain-mark"
              x1={terrainStart.x}
              y1={terrainStart.y}
              x2={terrainEnd.x}
              y2={terrainEnd.y}
            />
            <line
              className="sky-sightline"
              x1={center}
              y1={center}
              x2={position.x}
              y2={position.y}
            />
            <circle className="sky-point-halo" cx={position.x} cy={position.y} r="7" />
            <circle className="sky-point" cx={position.x} cy={position.y} r="3.5" />
            <title>{`${label}: elevación ${formatAngle(body.elevation)}, horizonte de terreno ${formatAngle(body.terrain)}`}</title>
          </g>
        )
      })}
      <circle className="sky-observer" cx={center} cy={center} r="2.5" />
    </svg>
  )
}

function VisibilityChart({ samples, date }) {
  const chart = { left: 36, right: 626, top: 16, bottom: 116 }
  const yAt = (value) => chart.bottom - ((Math.max(-30, Math.min(30, value)) + 30) / 60) * (chart.bottom - chart.top)
  const xAt = (timestamp) => {
    const date = new Date(timestamp)
    const minute = date.getUTCHours() * 60 + date.getUTCMinutes()
    return chart.left + (minute / 1440) * (chart.right - chart.left)
  }
  const pathFor = (object) => samples
    .map((sample, index) => `${index === 0 ? 'M' : 'L'} ${xAt(sample.time).toFixed(1)} ${yAt(sample[object].difference).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      className="visibility-chart"
      viewBox="0 0 640 150"
      role="img"
      aria-label="Margen angular del Sol y la Tierra sobre el horizonte de terreno durante el día"
    >
      {[-30, 0, 30].map((value) => (
        <g key={value}>
          <line className={value === 0 ? 'chart-zero' : 'chart-grid'} x1={chart.left} y1={yAt(value)} x2={chart.right} y2={yAt(value)} />
          <text className="chart-label" x="27" y={yAt(value) + 3} textAnchor="end">{value}°</text>
        </g>
      ))}
      <path className="chart-sun-line" d={pathFor('sun')} />
      <path className="chart-earth-line" d={pathFor('earth')} />
      <text className="chart-label" x={chart.left} y="140">00:00 UT</text>
      <text className="chart-label" x={(chart.left + chart.right) / 2} y="140" textAnchor="middle">12:00</text>
      <text className="chart-label" x={chart.right} y="140" textAnchor="end">24:00</text>
    </svg>
  )
}

function MetricCard({ Icon, label, value, detail, state }) {
  return (
    <article className={`planning-metric ${state === 'visible' ? 'metric-visible' : 'metric-hidden'}`}>
      <div className="metric-heading"><Icon size={16} aria-hidden="true" /><span>{label}</span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function PlanningPanel() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [downloaded, setDownloaded] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const [visibilitySamples, setVisibilitySamples] = useState(null)
  const [visibilityError, setVisibilityError] = useState('')
  const missionProfile = missionTypes.find((type) => type.id === form.missionType) ?? missionTypes[0]
  const steps = [
    { id: 'mission', label: 'Información general' },
    { id: 'vehicle', label: 'Vehículo y lanzamiento' },
    { id: 'site', label: 'Ubicación lunar' },
    ...missionProfile.conditionalSteps
      .filter((id) => id === 'crew')
      .map((id) => ({ id, label: 'Tripulación y soporte vital' })),
    ...missionProfile.conditionalSteps
      .filter((id) => id === 'logistics')
      .map((id) => ({ id, label: 'Logística de larga duración' })),
    ...missionProfile.conditionalSteps
      .filter((id) => id === 'sample')
      .map((id) => ({ id, label: 'Retorno de muestras' })),
    { id: 'date', label: 'Fecha y hora' },
    { id: 'environment', label: 'Condiciones ambientales' },
    { id: 'risk', label: 'Riesgos y seguridad' },
    { id: 'visibility', label: 'Luz y comunicación' },
    { id: 'compare', label: 'Comparar escenarios' },
    { id: 'summary', label: 'Resumen de misión' },
  ]
  const currentStep = steps[step] ?? steps[0]
  useEffect(() => {
    let active = true
    loadVisibilitySamples()
      .then((samples) => {
        if (active) setVisibilitySamples(samples)
      })
      .catch((error) => {
        if (active) {
          setVisibilityError(`No se pudo cargar el archivo de visibilidad (${error.message}).`)
        }
      })
    return () => { active = false }
  }, [])
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDownloaded(false)
    setValidationMessage('')
  }
  const selectMissionType = (typeId) => {
    const selectedType = missionTypes.find((type) => type.id === typeId)
    if (!selectedType) return
    setForm((current) => ({
      ...current,
      missionType: typeId,
      objective: selectedType.objectives.includes(current.objective)
        ? current.objective
        : selectedType.objectives[0],
      duration: selectedType.durations.includes(current.duration)
        ? current.duration
        : selectedType.durations[0],
      vehicle: selectedType.vehicles.includes(current.vehicle)
        ? current.vehicle
        : selectedType.vehicles[0],
      mass: selectedType.masses.includes(current.mass)
        ? current.mass
        : selectedType.masses[0],
      payload: selectedType.payloads.includes(current.payload)
        ? current.payload
        : selectedType.payloads[0],
    }))
    setStep(0)
    setDownloaded(false)
    setValidationMessage('')
  }

  const isModeledSite = form.site === 'site04'
  const selectedSample = useMemo(
    () => isModeledSite ? getNearestSample(visibilitySamples, form.dateTime) : null,
    [form.dateTime, isModeledSite, visibilitySamples],
  )
  const daySamples = useMemo(
    () => isModeledSite ? getDaySamples(visibilitySamples, form.dateTime.slice(0, 10)) : [],
    [form.dateTime, isModeledSite, visibilitySamples],
  )
  const comparisonSamples = useMemo(() => {
    if (!isModeledSite) return [null, null]
    const time = form.dateTime.slice(11, 16)
    return [
      getNearestSample(visibilitySamples, `${form.dateTime.slice(0, 10)}T${time}`),
      getNearestSample(visibilitySamples, `${form.compareDate}T${time}`),
    ]
  }, [form.compareDate, form.dateTime, isModeledSite, visibilitySamples])

  const updateCoordinate = (key, value) => update(key, value)
  const coordinatesValid =
    form.latitude.trim() !== '' &&
    form.longitude.trim() !== '' &&
    Number.isFinite(Number(form.latitude)) &&
    Number(form.latitude) >= -90 &&
    Number(form.latitude) <= 90 &&
    Number.isFinite(Number(form.longitude)) &&
    Number(form.longitude) >= 0 &&
    Number(form.longitude) <= 360
  const altitudeValid = form.elevation.trim() !== '' && Number.isFinite(Number(form.elevation))
  const siteInputsValid = coordinatesValid && altitudeValid
  const dateIsInCoverage = form.dateTime >= dateTimeMin && form.dateTime <= dateTimeMax
  const comparisonDateIsInCoverage =
    form.compareDate >= dateTimeMin.slice(0, 10) &&
    form.compareDate <= dateTimeMax.slice(0, 10)

  const goNext = () => {
    if (currentStep.id === 'mission' && !form.name.trim()) {
      setValidationMessage('Escribe un nombre para la misión antes de continuar.')
      return
    }
    if (currentStep.id === 'site' && !siteInputsValid) {
      setValidationMessage('Revisa latitud, longitud y altitud del sitio antes de continuar.')
      return
    }
    if (currentStep.id === 'date' && !dateIsInCoverage) {
      setValidationMessage('Selecciona una fecha dentro del intervalo de datos disponible.')
      return
    }
    if (currentStep.id === 'compare' && !comparisonDateIsInCoverage) {
      setValidationMessage('Selecciona una fecha alternativa dentro del intervalo de datos.')
      return
    }
    setValidationMessage('')
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const downloadPlan = () => {
    if (!form.name.trim() || !siteInputsValid || !dateIsInCoverage || !comparisonDateIsInCoverage) {
      setValidationMessage('Completa el nombre, las coordenadas y las fechas dentro del intervalo disponible antes de descargar.')
      return
    }
    const plan = {
      mission: {
        name: form.name.trim(),
        type: form.missionType,
        objective: form.objective,
        estimated_duration: form.duration,
        requirements: missionProfile.requirements,
      },
      vehicle: {
        class: form.vehicle,
        total_mass: form.mass,
        launch_site: form.launchSite,
        payload: form.payload,
        propulsion: form.propulsion,
        launch_window: form.launchWindow,
      },
      landing_site: {
        name: isModeledSite ? visibilitySite.name : 'Coordenadas personalizadas',
        latitude_deg: Number(form.latitude),
        longitude_east_deg: Number(form.longitude),
        elevation_m: Number(form.elevation),
        landing_area: form.landingArea,
        maximum_slope: form.maxSlope,
        visibility_model_available: isModeledSite,
      },
      mission_specific: {
        crew: missionProfile.conditionalSteps.includes('crew') ? {
          size: form.crewSize,
          eva_plan: form.evaPlan,
          life_support: form.lifeSupport,
          habitat_control: form.habitatControl,
        } : null,
        logistics: missionProfile.conditionalSteps.includes('logistics') ? {
          supplies: form.supplies,
          energy_redundancy: form.redundancy,
          in_situ_resource_utilization: form.isru,
        } : null,
        sample_return: missionProfile.conditionalSteps.includes('sample') ? {
          target: form.sampleTarget,
          collection_system: form.sampleCollection,
          return_system: form.sampleReturn,
        } : null,
      },
      environmental_factors: form.environment,
      risk_factors: form.risk,
      landing_time_utc: `${form.dateTime}:00Z`,
      comparison_date_utc: `${form.compareDate}T${form.dateTime.slice(11, 16)}:00Z`,
      visibility_sample: selectedSample ? {
        sampled_at_utc: new Date(selectedSample.time).toISOString(),
        sun: selectedSample.sun,
        earth: selectedSample.earth,
      } : null,
      comparison_visibility_sample: comparisonSamples[1] ? {
        sampled_at_utc: new Date(comparisonSamples[1].time).toISOString(),
        sun: comparisonSamples[1].sun,
        earth: comparisonSamples[1].earth,
      } : null,
      data_note: 'La visibilidad indica el centro aparente del objeto frente al horizonte LOLA muestreado; no estima potencia ni calidad del enlace.',
    }
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plan-lunar.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true)
  }

  const renderScenario = (sample, date, label) => {
    if (!sample || !date) {
      return (
        <article className="scenario-card" key={label}>
          <span className="scenario-label">{label}</span>
          <strong>{date ? formatUtcDate(Date.parse(`${date}T00:00:00Z`)) : 'Fecha sin seleccionar'}</strong>
          <p>
            {!date
              ? 'Selecciona una fecha para consultar este escenario.'
              : !isModeledSite
                ? 'Sin datos calculados para estas coordenadas.'
                : visibilityError || (visibilitySamples === null
                  ? 'Cargando muestras de visibilidad…'
                  : 'No se encontró una muestra para este instante.')}
          </p>
        </article>
      )
    }
    return (
      <article className="scenario-card" key={label}>
        <span className="scenario-label">{label}</span>
        <strong>{formatUtcDate(sample.time)} · {formatUtcTime(sample.time)} UT</strong>
        <div className="scenario-results">
          <span className={sample.sun.state === 'visible' ? 'status-positive' : 'status-negative'}>
            <Sun size={14} /> Sol {sample.sun.state === 'visible' ? 'visible' : 'oculto'}
            <b>{formatAngle(sample.sun.difference)}</b>
          </span>
          <span className={sample.earth.state === 'visible' ? 'status-positive' : 'status-negative'}>
            <Earth size={14} /> Tierra {sample.earth.state === 'visible' ? 'visible' : 'oculta'}
            <b>{formatAngle(sample.earth.difference)}</b>
          </span>
        </div>
      </article>
    )
  }

  return (
    <div className="planning-wizard">
      <header className="planning-brand">
        <div className="planning-wordmark"><Moon size={18} /><span>moonapp</span></div>
        <span className="planning-kicker">MISSION PLANNER / LUNAR SOUTH POLE</span>
      </header>

      <nav className="planning-stepper" aria-label="Pasos de planificación">
        {steps.map(({ label }, index) => (
          <button
            className={`step-number ${index === step ? 'is-current' : ''} ${index < step ? 'is-complete' : ''}`}
            key={steps[index].id}
            type="button"
            aria-label={`Paso ${index + 1}: ${label}`}
            aria-current={index === step ? 'step' : undefined}
            onClick={() => {
              setStep(index)
              setValidationMessage('')
            }}
          >
            {index < step ? <Check size={14} /> : index + 1}
          </button>
        ))}
      </nav>

      <main className="planning-content">
        <div className="planning-step-caption">Paso {String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')} · {currentStep.label}</div>

        {currentStep.id === 'mission' && (
          <section aria-labelledby="planning-title">
            <h2 id="planning-title">Planeación <em>de viaje</em></h2>
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
                    <span className="mission-type-letter">{type.letter}</span>
                    <span className="mission-type-copy">
                      <strong>{type.label}</strong>
                      <small>{type.description}</small>
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
              <label className="planning-label">
                Nombre de la misión
                <input value={form.name} maxLength={70} onChange={(event) => update('name', event.target.value)} />
              </label>
              <ChoiceGroup
                label="Objetivo científico"
                options={missionProfile.objectives}
                value={form.objective}
                onChange={(value) => update('objective', value)}
              />
              <ChoiceGroup
                label="Duración estimada"
                options={missionProfile.durations}
                value={form.duration}
                onChange={(value) => update('duration', value)}
              />
            </div>
            <div className="mission-plan-preview">
              <strong>Tu selección ajusta el plan</strong>
              <span>Se incluirán: {missionProfile.requirements.join(' · ')}.</span>
              <span>Se omitirán: {missionProfile.excluded.join(' · ')}.</span>
            </div>
          </section>
        )}

        {currentStep.id === 'vehicle' && (
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
              <ChoiceGroup label="Ventana de lanzamiento" options={['Oct 2026', 'Nov 2026', 'Dic 2026']} value={form.launchWindow} onChange={(value) => update('launchWindow', value)} />
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
        )}

        {currentStep.id === 'site' && (
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
        )}

        {currentStep.id === 'crew' && (
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
        )}

        {currentStep.id === 'logistics' && (
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
        )}

        {currentStep.id === 'sample' && (
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
        )}

        {currentStep.id === 'date' && (
          <section aria-labelledby="planning-title">
            <h2 id="planning-title">Fecha y <em>hora</em></h2>
            <p className="planning-intro">Explora cómo cambia la iluminación y la comunicación directa al mover la fecha de aterrizaje.</p>
            <div className="landing-date-card">
              <label className="planning-label">
                Fecha y hora del escenario (UTC)
                <input
                  type="datetime-local"
                  min={dateTimeMin}
                  max={dateTimeMax}
                  value={form.dateTime}
                  onChange={(event) => update('dateTime', event.target.value)}
                />
              </label>
              <div className="date-range">
                <span>INICIO DE DATOS <b>14 NOV 2026</b></span>
                <span>FIN DE DATOS <b>12 FEB 2027</b></span>
              </div>
            </div>
            <div className="planning-callout">
              <span className="live-dot" />
              <p>El intervalo corresponde a la cobertura disponible de Horizons y del horizonte de terreno LOLA para Site 04.</p>
            </div>
            {!dateIsInCoverage && <p className="planning-error">Selecciona una fecha dentro del intervalo de datos.</p>}
          </section>
        )}

        {currentStep.id === 'environment' && (
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
        )}

        {currentStep.id === 'risk' && (
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
        )}

        {currentStep.id === 'visibility' && (
          <section aria-labelledby="planning-title">
            <h2 id="planning-title">Luz y <em>comunicación</em></h2>
            <p className="planning-intro">Posición aparente respecto al horizonte local en el instante seleccionado.</p>
            {!isModeledSite || (isModeledSite && visibilityError) || !selectedSample ? (
              <div className="no-visibility-data">
                {isModeledSite && visibilityError ? <Info size={21} /> : <MapPin size={21} />}
                <strong>
                  {isModeledSite && visibilityError
                    ? 'No se pudieron cargar las muestras'
                    : !isModeledSite
                      ? 'Sin datos calculados para este sitio'
                      : visibilitySamples === null
                        ? 'Cargando muestras de visibilidad'
                        : 'No hay una muestra para este instante'}
                </strong>
                <span>
                  {(isModeledSite && visibilityError) || (!isModeledSite
                    ? 'El modelo actual cubre únicamente Shackleton Site 04. No se estiman valores para coordenadas propias.'
                    : 'Comprueba el archivo de visibilidad de Site 04 y vuelve a abrir la planificación.')}
                </span>
              </div>
            ) : (
              <>
                <div className="visibility-topline">
                  <span><MapPin size={14} /> Site 04 · Shackleton</span>
                  <span>{formatUtcDate(selectedSample.time)} · {formatUtcTime(selectedSample.time)} UT</span>
                </div>
                <div className="visibility-grid">
                  <div className="sky-card">
                    <SkyDiagram sample={selectedSample} />
                    <div className="sky-legend">
                      <span className="legend-sun"><i /> Sol</span>
                      <span className="legend-earth"><i /> Tierra</span>
                      <span className="legend-horizon"><i /> horizonte 0°</span>
                      <span className="legend-terrain"><i /> horizonte LOLA</span>
                    </div>
                  </div>
                  <div className="metrics-stack">
                    <MetricCard
                      Icon={Sun}
                      label="Iluminación solar"
                      value={selectedSample.sun.state === 'visible' ? 'Visible' : 'Oculto'}
                      detail={`Elevación ${formatAngle(selectedSample.sun.elevation)} · margen ${formatAngle(selectedSample.sun.difference)}`}
                      state={selectedSample.sun.state}
                    />
                    <MetricCard
                      Icon={Earth}
                      label="Enlace directo a Tierra"
                      value={selectedSample.earth.state === 'visible' ? 'Visible' : 'Oculta'}
                      detail={`Elevación ${formatAngle(selectedSample.earth.elevation)} · margen ${formatAngle(selectedSample.earth.difference)}`}
                      state={selectedSample.earth.state}
                    />
                    <p className="metric-footnote">La visibilidad geométrica no estima generación eléctrica ni calidad del enlace.</p>
                  </div>
                </div>
                <div className="chart-card">
                  <div className="chart-heading">
                    <span>Margen sobre horizonte durante el día</span>
                    <div className="chart-legend"><span className="legend-sun"><i /> Sol</span><span className="legend-earth"><i /> Tierra</span></div>
                  </div>
                  <VisibilityChart samples={daySamples} date={form.dateTime.slice(0, 10)} />
                  <p className="chart-footnote">Sobre 0° = visible · Bajo 0° = oculto · {formatUtcDate(Date.parse(`${form.dateTime.slice(0, 10)}T00:00:00Z`))} UT</p>
                </div>
              </>
            )}
          </section>
        )}

        {currentStep.id === 'compare' && (
          <section aria-labelledby="planning-title">
            <h2 id="planning-title">Compara <em>escenarios</em></h2>
            <p className="planning-intro">Compara dos fechas para el mismo sitio y la misma hora UTC.</p>
            <label className="planning-label compare-date-input">
              Fecha alternativa
              <input type="date" min={dateTimeMin.slice(0, 10)} max={dateTimeMax.slice(0, 10)} value={form.compareDate} onChange={(event) => update('compareDate', event.target.value)} />
            </label>
            {visibilityError && <p className="planning-error" role="alert">{visibilityError}</p>}
            <div className="scenario-grid">
              {renderScenario(comparisonSamples[0], form.dateTime.slice(0, 10), 'ESCENARIO A · FECHA ORIGINAL')}
              {renderScenario(comparisonSamples[1], form.compareDate, 'ESCENARIO B · FECHA ALTERNATIVA')}
            </div>
            <p className="planning-hint">Los resultados comparan el centro aparente de cada cuerpo con el horizonte LOLA de Site 04. Las fechas son muestras discretas, no una predicción de potencia o rendimiento de radio.</p>
          </section>
        )}

        {currentStep.id === 'summary' && (
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
        )}

        <footer className="planning-navigation">
          {validationMessage && <p className="planning-error" role="alert">{validationMessage}</p>}
          <button className="planning-back-button" type="button" onClick={() => {
            setStep((current) => Math.max(current - 1, 0))
            setValidationMessage('')
          }} disabled={step === 0}>
            <ChevronLeft size={16} /> Anterior
          </button>
          {step < steps.length - 1 && (
            <button className="planning-next-button" type="button" onClick={goNext}>
              Siguiente <ChevronRight size={16} />
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}

export default PlanningPanel
