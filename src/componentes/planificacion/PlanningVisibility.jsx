import { Earth, Info, MapPin, Sun } from 'lucide-react'
import visibilityCsvUrl from '../../../data/visibility/visibility.csv?url'
import MatrixHeading from './PlanningMatrixHeading'

// --- Datos de visibilidad: cobertura, carga del CSV y utilidades ---
export const dateTimeMin = '2026-11-14T00:00'
export const dateTimeMax = '2027-02-12T00:00'
let visibilitySamplesPromise

function parseVisibilityCsv(csv) {
  const visibilityByTime = new Map()
  csv.trim().split(/\r?\n/).slice(1).forEach((line) => {
    const [time, object, azimuth, elevation, terrain, difference, state] = line.split(',')
    const sampleTime = Date.parse(time)
    const sample = visibilityByTime.get(sampleTime) ?? { time: sampleTime, horizonBasis: 'terrain' }
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
    throw new Error('The CSV does not contain valid samples for the Sun and the Earth.')
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
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(timestamp)
}

export function formatUtcTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
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
    { key: 'sun', label: 'Sun' },
    { key: 'earth', label: 'Earth' },
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
      aria-label={`Sun position at ${formatAngle(sample.sun.elevation)} and Earth at ${formatAngle(sample.earth.elevation)} relative to the horizon`}
    >
      <circle className="sky-grid" cx={center} cy={center} r="36" />
      <circle className="sky-grid" cx={center} cy={center} r="55" />
      <circle className="sky-horizon" cx={center} cy={center} r={horizonRadius} />
      <line className="sky-axis" x1={center} y1="27" x2={center} y2="193" />
      <line className="sky-axis" x1="27" y1={center} x2="193" y2={center} />
      <text className="sky-cardinal" x={center} y="16" textAnchor="middle">N</text>
      <text className="sky-cardinal" x="207" y={center + 3} textAnchor="middle">E</text>
      <text className="sky-cardinal" x={center} y="215" textAnchor="middle">S</text>
      <text className="sky-cardinal" x="13" y={center + 3} textAnchor="middle">W</text>
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
            <title>{`${label}: elevation ${formatAngle(body.elevation)}, terrain horizon ${formatAngle(body.terrain)}`}</title>
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
      aria-label="Angular margin of the Sun and the Earth above the terrain horizon during the day"
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
// --- Recorrido de fechas dentro del intervalo de datos ---
export function DateStep({ form, update, dateIsInCoverage, maxDateTime }) {
  const rangeStart = Date.parse(`${dateTimeMin}:00Z`)
  const rangeEnd = Date.parse(`${maxDateTime}:00Z`)
  const rangeHours = Math.max(1, Math.round((rangeEnd - rangeStart) / 3600000))
  const hoursToInput = (hours) => new Date(rangeStart + hours * 3600000).toISOString().slice(0, 16)
  const datePresets = [
    { label: 'Start', hours: 0 },
    { label: '+30 days', hours: 720 },
    { label: '+60 days', hours: 1440 },
    { label: 'End', hours: rangeHours },
  ].filter((preset) => preset.hours <= rangeHours)
  const monthTicks = []
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
  const first = new Date(rangeStart)
  let tick = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)
  while (tick < rangeEnd) {
    monthTicks.push({ label: formatter.format(tick).replace('.', ''), left: ((tick - rangeStart) / (rangeEnd - rangeStart)) * 100 })
    const next = new Date(tick)
    tick = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)
  }
  const current = Date.parse(`${form.dateTime}:00Z`)
  const hasDate = Number.isFinite(current)
  const offset = hasDate ? Math.min(Math.max(Math.round((current - rangeStart) / 3600000), 0), rangeHours) : 0
  return (
    <section aria-labelledby="date-step-title">
      <MatrixHeading id="date-step-title" text="Date and" emphasis="time" />
      <p className="planning-intro">Move the slider to scan the data range. The environment below is recalculated instantly.</p>
      <div className="landing-date-card">
        <div className="date-readout">
          <strong>{hasDate ? `${formatUtcDate(current)} · ${formatUtcTime(current)} UT` : 'No date selected'}</strong>
          <span>Day {Math.floor(offset / 24) + 1} of {Math.floor(rangeHours / 24) + 1}</span>
        </div>
        <input
          className="date-slider"
          type="range"
          min="0"
          max={rangeHours}
          step="1"
          value={offset}
          aria-label="Scan the data range by hours"
          style={{ '--fill': `${(offset / rangeHours) * 100}%` }}
          onChange={(event) => update('dateTime', hoursToInput(Number(event.target.value)))}
        />
        <div className="slider-ticks" aria-hidden="true">
          {monthTicks.map((tick) => <span key={tick.label + tick.left} style={{ left: `${tick.left}%` }}>{tick.label}</span>)}
        </div>
        <div className="date-presets">
          {datePresets.map((preset) => (
            <button className={`planning-choice ${offset === preset.hours ? 'is-selected' : ''}`} type="button" key={preset.label} onClick={() => update('dateTime', hoursToInput(preset.hours))}>
              {preset.label}
            </button>
          ))}
        </div>
        <label className="planning-label date-exact">
          Exact date and time (UTC)
          <input
            type="datetime-local"
            min={dateTimeMin}
            max={maxDateTime}
            value={form.dateTime}
            onChange={(event) => update('dateTime', event.target.value)}
          />
        </label>
        <div className="date-range">
          <span>AVAILABLE START <b>{formatUtcDate(rangeStart).toUpperCase()}</b></span>
          <span>AVAILABLE END <b>{formatUtcDate(rangeEnd).toUpperCase()}</b></span>
        </div>
      </div>
      <div className="planning-callout">
        <span className="live-dot" />
        <p>Range of the local dataset; it is not a launch window nor a date validated by NASA.</p>
      </div>
      {!dateIsInCoverage && <p className="planning-error">Select a date within the data range.</p>}
    </section>
  )
}

export function VisibilityStep({ form, isModeledSite, visibilityError, visibilityLoading, visibilitySamples, selectedSample, daySamples, onRetry }) {
  const sampleIsTerrainBased = selectedSample?.horizonBasis !== 'geometric'
  return (
    <section aria-labelledby="visibility-step-title">
      <MatrixHeading id="visibility-step-title" text="Light and" emphasis="communication" />
      <p className="planning-intro">Geometric position relative to the local horizon; it does not estimate power or link quality.</p>
      {!selectedSample ? (
        <div className="no-visibility-data">
          {visibilityError ? <Info size={21} /> : <MapPin size={21} />}
          <strong>
            {visibilityError
              ? 'The samples could not be loaded'
              : visibilityLoading
                ? 'Calculating visibility for this site'
                : !isModeledSite
                  ? 'There is no calculated sample for this site'
                  : visibilitySamples === null
                  ? 'Loading visibility samples'
                  : 'There is no sample for this instant'}
          </strong>
          <span>
            {visibilityError || (visibilityLoading
              ? 'Querying Horizons and the LOLA topographic profile.'
              : !isModeledSite
                ? 'Check the coordinates, the elevation and that the lunar service is available.'
                : 'Check the Site 04 visibility file and reopen the planning.')}
          </span>
          {visibilityError && !isModeledSite && <button className="planning-choice" type="button" onClick={onRetry}>Retry calculation</button>}
        </div>
      ) : (
        <>
          <div className="visibility-topline">
            <span><MapPin size={14} /> {isModeledSite ? 'Site 04 · Shackleton' : `${Number(form.latitude).toFixed(4)}°, ${Number(form.longitude).toFixed(4)}° E · ${form.elevation} m`}</span>
            <span>{formatUtcDate(selectedSample.time)} · {formatUtcTime(selectedSample.time)} UT</span>
          </div>
          {!sampleIsTerrainBased && <p className="planning-hint">LOLA does not have enough coverage at this point. The states show only the geometric horizon; the terrain remains undetermined. {selectedSample.terrainReason}</p>}
          <div className="visibility-grid">
            <div className="sky-card">
              <SkyDiagram sample={selectedSample} />
              <div className="sky-legend">
                <span className="legend-sun"><i /> Sun</span>
                <span className="legend-earth"><i /> Earth</span>
                <span className="legend-horizon"><i /> 0° horizon</span>
                <span className="legend-terrain"><i /> {sampleIsTerrainBased ? 'LOLA horizon' : 'geometric horizon'}</span>
              </div>
            </div>
            <div className="metrics-stack">
              <MetricCard
                Icon={Sun}
                label="Solar illumination"
                value={selectedSample.sun.state === 'visible' ? (sampleIsTerrainBased ? 'Visible' : 'Above horizon') : (sampleIsTerrainBased ? 'Hidden' : 'Below horizon')}
                detail={`Elevation ${formatAngle(selectedSample.sun.elevation)} · margin ${formatAngle(selectedSample.sun.difference)}`}
                state={selectedSample.sun.state}
              />
              <MetricCard
                Icon={Earth}
                label="Direct link to Earth"
                value={selectedSample.earth.state === 'visible' ? (sampleIsTerrainBased ? 'Visible' : 'Above horizon') : (sampleIsTerrainBased ? 'Hidden' : 'Below horizon')}
                detail={`Elevation ${formatAngle(selectedSample.earth.elevation)} · margin ${formatAngle(selectedSample.earth.difference)}`}
                state={selectedSample.earth.state}
              />
              <p className="metric-footnote">{sampleIsTerrainBased ? 'Visibility over terrain does not estimate power generation or link quality.' : 'Geometric visibility does not confirm a line of sight free of terrain, nor does it estimate power or link quality.'}</p>
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-heading">
              <span>{sampleIsTerrainBased ? 'Margin above the LOLA horizon during the day' : 'Elevation above the geometric horizon during the day'}</span>
              <div className="chart-legend"><span className="legend-sun"><i /> Sun</span><span className="legend-earth"><i /> Earth</span></div>
            </div>
            <VisibilityChart samples={daySamples} date={form.dateTime.slice(0, 10)} />
            <p className="chart-footnote">Above 0° = visible · Below 0° = hidden · {formatUtcDate(Date.parse(`${form.dateTime.slice(0, 10)}T00:00:00Z`))} UT</p>
          </div>
        </>
      )}
    </section>
  )
}

export function CompareStep({ form, update, isModeledSite, maxDateTime, visibilityError, visibilityLoading, visibilitySamples, comparisonSamples, onRetry }) {
  const renderScenario = (sample, date, label) => {
    if (!sample || !date) {
      return (
        <article className="scenario-card" key={label}>
          <span className="scenario-label">{label}</span>
          <strong>{date ? formatUtcDate(Date.parse(`${date}T00:00:00Z`)) : 'No date selected'}</strong>
          <p>
            {!date
              ? 'Select a date to query this scenario.'
              : visibilityError || (visibilityLoading
                ? 'Calculating ephemerides and topographic profile…'
                : !isModeledSite
                  ? 'No sample is available for this site and date.'
                  : visibilitySamples === null
                  ? 'Loading visibility samples…'
                  : 'No sample was found for this instant.')}
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
            <Sun size={14} /> Sun {sample.sun.state === 'visible' ? 'visible' : 'hidden'}
            <b>{formatAngle(sample.sun.difference)}</b>
          </span>
          <span className={sample.earth.state === 'visible' ? 'status-positive' : 'status-negative'}>
            <Earth size={14} /> Earth {sample.earth.state === 'visible' ? 'visible' : 'hidden'}
            <b>{formatAngle(sample.earth.difference)}</b>
          </span>
        </div>
      </article>
    )
  }

  return (
    <section aria-labelledby="compare-step-title">
      <MatrixHeading id="compare-step-title" text="Compare" emphasis="scenarios" />
      <p className="planning-intro">Compare two dates for the same site and the same UTC time.</p>
      <label className="planning-label compare-date-input">
        Alternative date
        <input type="date" min={dateTimeMin.slice(0, 10)} max={maxDateTime.slice(0, 10)} value={form.compareDate} onChange={(event) => update('compareDate', event.target.value)} />
      </label>
      {visibilityError && <p className="planning-error" role="alert">{visibilityError} {!isModeledSite && <button className="planning-choice" type="button" onClick={onRetry}>Retry</button>}</p>}
      <div className="scenario-grid">
        {renderScenario(comparisonSamples[0], form.dateTime.slice(0, 10), 'SCENARIO A · ORIGINAL DATE')}
        {renderScenario(comparisonSamples[1], form.compareDate, 'SCENARIO B · ALTERNATIVE DATE')}
      </div>
      <p className="planning-hint">{isModeledSite ? 'The results compare the apparent center of each body with the LOLA horizon of Shackleton.' : comparisonSamples.some((sample) => sample?.horizonBasis === 'geometric') ? 'Without LOLA coverage, the states only compare against the geometric horizon; terrain obstruction is undetermined.' : 'The results compare the apparent center of each body with the LOLA horizon profile of the site.'} The samples are hourly and do not predict power or radio performance.</p>
    </section>
  )
}
