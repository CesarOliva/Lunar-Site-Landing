import { Earth, Info, MapPin, Sun } from 'lucide-react'
import visibilityCsvUrl from '../../../Data_Structure/data/visibility/visibility.csv?url'

// --- Datos de visibilidad: cobertura, carga del CSV y utilidades ---
export const dateTimeMin = '2026-11-14T00:00'
export const dateTimeMax = '2027-02-12T00:00'
let visibilitySamplesPromise

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

export function loadVisibilitySamples() {
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

export function getNearestSample(samples, dateTime) {
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

export function getDaySamples(samples, date) {
  return (samples ?? []).filter((sample) =>
    new Date(sample.time).toISOString().startsWith(`${date}T`),
  )
}

export function formatUtcDate(timestamp) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(timestamp)
}

export function formatUtcTime(timestamp) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(timestamp)
}

export function formatAngle(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}°`
}

// --- Gráficas y tarjetas ---
export function SkyDiagram({ sample }) {
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

export function VisibilityChart({ samples, date }) {
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

export function MetricCard({ Icon, label, value, detail, state }) {
  return (
    <article className={`planning-metric ${state === 'visible' ? 'metric-visible' : 'metric-hidden'}`}>
      <div className="metric-heading"><Icon size={16} aria-hidden="true" /><span>{label}</span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
// --- Pasos: fecha, luz y comunicación, comparar escenarios ---
export function DateStep({ form, update, dateIsInCoverage }) {
  return (
    <section aria-labelledby="date-step-title">
      <h2 id="date-step-title">Fecha y <em>hora</em></h2>
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
        <p>Rango del conjunto de datos local; no es una ventana de lanzamiento ni una fecha validada por NASA.</p>
      </div>
      {!dateIsInCoverage && <p className="planning-error">Selecciona una fecha dentro del intervalo de datos.</p>}
    </section>
  )
}

export function VisibilityStep({ form, isModeledSite, visibilityError, visibilitySamples, selectedSample, daySamples }) {
  return (
    <section aria-labelledby="visibility-step-title">
      <h2 id="visibility-step-title">Luz y <em>comunicación</em></h2>
      <p className="planning-intro">Posición geométrica respecto al horizonte local; no estima energía ni calidad del enlace.</p>
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
  )
}

export function CompareStep({ form, update, isModeledSite, visibilityError, visibilitySamples, comparisonSamples }) {
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
    <section aria-labelledby="compare-step-title">
      <h2 id="compare-step-title">Compara <em>escenarios</em></h2>
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
  )
}