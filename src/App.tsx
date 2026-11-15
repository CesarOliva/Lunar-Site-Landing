import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import exampleCsv from '../data/muestras_ejemplo.csv?raw'

const ApolloExplorer = lazy(() => import('./ApolloExplorer'))

type State = 'visible' | 'hidden' | 'indeterminate'
type Mode = 'sites' | 'periods'
type Sample = {
  siteId: string
  start: number
  end: number
  sunAzimuth: number | null
  sunElevation: number | null
  horizonElevation: number | null
  sunSource: string | null
  horizonSource: string | null
}
type Segment = Sample & { id: string; state: State; gap?: boolean }
type Totals = { visible: number; hidden: number; indeterminate: number; interruptions: number; duration: number }

const initialRange = {
  startA: '2025-01-01T00:00:00',
  endA: '2025-01-01T00:02:00',
  startB: '2025-01-02T00:00:00',
  endB: '2025-01-02T00:02:00',
}

function parseLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && quoted && line[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  if (quoted) throw new Error('Hay una celda CSV con comillas sin cerrar.')
  cells.push(cell)
  return cells
}

function parseCsv(text: string): Sample[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) throw new Error('El CSV está vacío.')
  const headers = parseLine(lines[0]).map((header) => header.trim())
  const required = ['site_id', 'start_utc', 'end_utc', 'sun_azimuth_deg', 'sun_elevation_deg', 'horizon_elevation_deg']
  const missing = required.filter((field) => !headers.includes(field))
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}.`)
  const rows: Sample[] = []

  lines.slice(1).forEach((line, rowIndex) => {
    const cells = parseLine(line)
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    const lineNumber = rowIndex + 2
    const siteId = row.site_id.trim()
    const start = parseUtc(row.start_utc, `Fila ${lineNumber}, start_utc`)
    const end = parseUtc(row.end_utc, `Fila ${lineNumber}, end_utc`)
    if (!siteId) throw new Error(`Fila ${lineNumber}: site_id está vacío.`)
    if (end <= start) throw new Error(`Fila ${lineNumber}: end_utc debe ser posterior a start_utc.`)
    const sunAzimuth = optionalNumber(row.sun_azimuth_deg, `Fila ${lineNumber}, sun_azimuth_deg`)
    const sunElevation = optionalNumber(row.sun_elevation_deg, `Fila ${lineNumber}, sun_elevation_deg`)
    const horizonElevation = optionalNumber(row.horizon_elevation_deg, `Fila ${lineNumber}, horizon_elevation_deg`)
    if (sunAzimuth !== null && (sunAzimuth < 0 || sunAzimuth >= 360)) throw new Error(`Fila ${lineNumber}: el azimut debe estar en [0, 360).`)
    if ([sunElevation, horizonElevation].some((angle) => angle !== null && (angle < -90 || angle > 90))) {
      throw new Error(`Fila ${lineNumber}: las elevaciones deben estar en [-90, 90].`)
    }
    rows.push({
      siteId,
      start,
      end,
      sunAzimuth,
      sunElevation,
      horizonElevation,
      sunSource: row.sun_source?.trim() || null,
      horizonSource: row.horizon_source?.trim() || null,
    })
  })

  if (!rows.length) throw new Error('El CSV no contiene muestras.')
  const grouped = new Map<string, Sample[]>()
  rows.forEach((row) => grouped.set(row.siteId, [...(grouped.get(row.siteId) ?? []), row]))
  grouped.forEach((siteRows, siteId) => {
    siteRows.sort((a, b) => a.start - b.start)
    siteRows.slice(1).forEach((row, index) => {
      if (row.start < siteRows[index].end) throw new Error(`Hay intervalos superpuestos para ${siteId}.`)
    })
  })
  return rows
}

function parseUtc(value: string, label: string): number {
  if (!/(Z|[+-]00:00)$/i.test(value.trim())) throw new Error(`${label}: indica una zona UTC, por ejemplo 2025-01-01T00:00:00Z.`)
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label}: fecha ISO 8601 inválida.`)
  return parsed
}

function optionalNumber(value: string | undefined, label: string): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser numérico.`)
  return parsed
}

function utcFromInput(value: string, label: string): number {
  if (!value) throw new Error(`${label}: selecciona fecha y hora.`)
  return parseUtc(`${value}${value.length === 16 ? ':00' : ''}Z`, label)
}

function classify(row: Sample): State {
  if (row.sunElevation === null || row.horizonElevation === null) return 'indeterminate'
  return row.sunElevation > row.horizonElevation ? 'visible' : 'hidden'
}

function clip(rows: Sample[], siteId: string, start: number, end: number, prefix: string): Segment[] {
  if (end <= start) throw new Error('La hora final debe ser posterior a la inicial.')
  let cursor = start
  const result: Segment[] = []
  rows.filter((row) => row.siteId === siteId).sort((a, b) => a.start - b.start).forEach((row, index) => {
    const left = Math.max(start, row.start)
    const right = Math.min(end, row.end)
    if (right <= left) return
    if (left > cursor) {
      result.push({ id: `${prefix}-gap-${index}`, siteId, start: cursor, end: left, sunAzimuth: null, sunElevation: null, horizonElevation: null, sunSource: null, horizonSource: null, state: 'indeterminate', gap: true })
    }
    if (left < cursor) throw new Error(`Hay muestras superpuestas en el periodo de ${siteId}.`)
    result.push({ ...row, id: `${prefix}-${index}`, start: left, end: right, state: classify(row) })
    cursor = right
  })
  if (cursor < end) result.push({ id: `${prefix}-tail`, siteId, start: cursor, end, sunAzimuth: null, sunElevation: null, horizonElevation: null, sunSource: null, horizonSource: null, state: 'indeterminate', gap: true })
  return result
}

function totals(segments: Segment[]): Totals {
  const summary = { visible: 0, hidden: 0, indeterminate: 0, interruptions: 0, duration: 0 }
  segments.forEach((segment, index) => {
    const duration = segment.end - segment.start
    summary[segment.state] += duration
    summary.duration += duration
    if (segment.state === 'hidden' && (index === 0 || segments[index - 1].state !== 'hidden')) summary.interruptions += 1
  })
  return summary
}

function coincidence(a: Segment[], b: Segment[], offsetB = 0): number {
  let total = 0
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const leftB = b[j].start - offsetB
    const rightB = b[j].end - offsetB
    const start = Math.max(a[i].start, leftB)
    const end = Math.min(a[i].end, rightB)
    if (end > start && a[i].state === 'visible' && b[j].state === 'visible') total += end - start
    if (a[i].end <= rightB) i += 1
    else j += 1
  }
  return total
}

function formatHours(milliseconds: number): string {
  return (milliseconds / 3_600_000).toFixed(3)
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(value)
}

function stateName(state: State): string {
  return state === 'visible' ? 'Visible' : state === 'hidden' ? 'Oculto' : 'Indeterminado'
}

function TimelineLane({ label, segments, start, end, selectedId, onSelect }: {
  label: string
  segments: Segment[]
  start: number
  end: number
  selectedId: string | null
  onSelect: (segment: Segment) => void
}) {
  const duration = end - start
  return (
    <div className="timeline-lane">
      <div className="lane-heading"><span>{label}</span><span className="lane-range">{formatDate(start)} — {formatDate(end)}</span></div>
      <div className="timeline-track" role="group" aria-label={`Intervalos de ${label}`}>
        {segments.map((segment) => {
          const left = ((segment.start - start) / duration) * 100
          const width = ((segment.end - segment.start) / duration) * 100
          return (
            <button
              key={segment.id}
              type="button"
              className={`time-segment state-${segment.state}${selectedId === segment.id ? ' is-selected' : ''}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onSelect(segment)}
              aria-label={`${stateName(segment.state)}. ${formatDate(segment.start)} a ${formatDate(segment.end)}. Seleccionar intervalo.`}
              title={`${stateName(segment.state)} · ${formatDate(segment.start)} — ${formatDate(segment.end)}`}
            />
          )
        })}
      </div>
      <div className="timeline-ticks"><span>{formatDate(start)}</span><span>{formatDate((start + end) / 2)}</span><span>{formatDate(end)}</span></div>
    </div>
  )
}

function AngleLane({ label, segments, start, end, accent, onSelect }: {
  label: string
  segments: Segment[]
  start: number
  end: number
  accent: string
  onSelect: (segment: Segment) => void
}) {
  const samples = segments.filter((segment) => segment.sunElevation !== null && segment.horizonElevation !== null)
  const values = samples.flatMap((segment) => [segment.sunElevation!, segment.horizonElevation!])
  const floor = Math.min(0, ...values) - 2
  const ceiling = Math.max(4, ...values) + 2
  const y = (value: number) => 68 - ((value - floor) / (ceiling - floor)) * 54
  const zeroY = y(0)
  const duration = end - start
  return (
    <div className="angle-lane">
      <div className="lane-heading"><span>{label}</span><span className="angle-axis">{ceiling.toFixed(0)}° <span>/</span> {floor.toFixed(0)}°</span></div>
      <svg className="angle-chart" viewBox="0 0 1000 84" role="img" aria-label={`${label}: elevación solar y horizonte local en grados`} preserveAspectRatio="none">
        <line x1="0" x2="1000" y1={zeroY} y2={zeroY} className="zero-line" />
        {segments.map((segment) => {
          const x1 = ((segment.start - start) / duration) * 1000
          const x2 = ((segment.end - start) / duration) * 1000
          if (segment.sunElevation === null || segment.horizonElevation === null) {
            return <rect key={segment.id} x={x1} y="7" width={Math.max(x2 - x1, 1)} height="68" className="angle-missing" onClick={() => onSelect(segment)} />
          }
          const center = (x1 + x2) / 2
          return (
            <g key={segment.id} onClick={() => onSelect(segment)} className="angle-mark" tabIndex={0} role="button" aria-label={`${formatDate(segment.start)}: Sol ${segment.sunElevation} grados, horizonte ${segment.horizonElevation} grados`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(segment) }}>
              <line x1={center} x2={center} y1={y(segment.sunElevation)} y2={y(segment.horizonElevation)} stroke={accent} strokeWidth="3" />
              <line x1={x1} x2={x2} y1={y(segment.horizonElevation)} y2={y(segment.horizonElevation)} className="horizon-mark" />
              <circle cx={center} cy={y(segment.sunElevation)} r="4" fill={accent} />
            </g>
          )
        })}
      </svg>
      <div className="angle-key"><span><i className="key-sun" style={{ backgroundColor: accent }} /> Elevación del Sol</span><span><i className="key-horizon" /> Horizonte</span></div>
    </div>
  )
}

function App() {
  const [view, setView] = useState<'missions' | 'compare'>('missions')
  const [rows, setRows] = useState<Sample[]>([])
  const [fileName, setFileName] = useState('muestras_ejemplo.csv')
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<Mode>('sites')
  const [siteA, setSiteA] = useState('polar-a')
  const [siteB, setSiteB] = useState('polar-b')
  const [sameSite, setSameSite] = useState('polar-a')
  const [range, setRange] = useState(initialRange)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      setRows(parseCsv(exampleCsv))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el CSV de demostración.')
    }
  }, [])

  const sites = useMemo(() => [...new Set(rows.map((row) => row.siteId))].sort(), [rows])
  const comparison = useMemo(() => {
    if (!rows.length) return null
    try {
      if (mode === 'sites') {
        const start = utcFromInput(range.startA, 'Inicio del periodo')
        const end = utcFromInput(range.endA, 'Fin del periodo')
        const a = clip(rows, siteA, start, end, 'a')
        const b = clip(rows, siteB, start, end, 'b')
        return { a, b, startA: start, endA: end, startB: start, endB: end, match: coincidence(a, b), error: '' }
      }
      const startA = utcFromInput(range.startA, 'Inicio del periodo A')
      const endA = utcFromInput(range.endA, 'Fin del periodo A')
      const startB = utcFromInput(range.startB, 'Inicio del periodo B')
      const endB = utcFromInput(range.endB, 'Fin del periodo B')
      if (endA - startA !== endB - startB) throw new Error('Los dos periodos deben tener la misma duración.')
      const a = clip(rows, sameSite, startA, endA, 'a')
      const b = clip(rows, sameSite, startB, endB, 'b')
      return { a, b, startA, endA, startB, endB, match: coincidence(a, b, startB - startA), error: '' }
    } catch (error) {
      return { a: [], b: [], startA: 0, endA: 0, startB: 0, endB: 0, match: 0, error: error instanceof Error ? error.message : 'No se pudo calcular la comparación.' }
    }
  }, [rows, mode, siteA, siteB, sameSite, range])

  const summaryA = comparison ? totals(comparison.a) : null
  const summaryB = comparison ? totals(comparison.b) : null
  const selected = comparison ? [...comparison.a, ...comparison.b].find((segment) => segment.id === selectedId) ?? null : null
  const titleA = mode === 'sites' ? siteA : `${sameSite} · periodo A`
  const titleB = mode === 'sites' ? siteB : `${sameSite} · periodo B`

  const setDate = (key: keyof typeof range, value: string) => setRange((current) => ({ ...current, [key]: value }))
  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setRows(parseCsv(await file.text()))
      setFileName(file.name)
      setLoadError('')
      setSelectedId(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo leer el CSV.')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Lunar Site Navigator, inicio">
          <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5" /><path d="M9 20.5a9 9 0 0 0 15.3-6.4M8.8 12.7A8.9 8.9 0 0 1 22 8.1M16 3.5v4M16 24.5v4M3.5 16h4M24.5 16h4" /><circle cx="16" cy="16" r="2.1" /></svg>
          <span>Lunar Site Navigator</span>
        </a>
        <nav className="primary-nav" aria-label="Secciones del navegador lunar">
          <button type="button" className={view === 'missions' ? 'active' : ''} aria-pressed={view === 'missions'} onClick={() => setView('missions')}>Misiones Apollo</button>
          <button type="button" className={view === 'compare' ? 'active' : ''} aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Comparar ventanas</button>
        </nav>
        <div className="topbar-meta"><span className="status-dot" />{view === 'missions' ? 'Escenas históricas' : 'Comparador de visibilidad'}</div>
      </header>

      {view === 'missions' ? <Suspense fallback={<div className="loading-page" role="status">Cargando escena lunar…</div>}><ApolloExplorer /></Suspense> : <section className="workspace" id="inicio">
        <aside className="controls-panel" aria-labelledby="controls-title">
          <div className="panel-title">
            <h1 id="controls-title">Comparar ventanas</h1>
            <p>Revisa cuándo el Sol supera el horizonte local en cada sitio.</p>
          </div>

          <div className="mode-switch" role="group" aria-label="Tipo de comparación">
            <button type="button" className={mode === 'sites' ? 'active' : ''} aria-pressed={mode === 'sites'} onClick={() => { setMode('sites'); setSelectedId(null) }}>Dos sitios</button>
            <button type="button" className={mode === 'periods' ? 'active' : ''} aria-pressed={mode === 'periods'} onClick={() => { setMode('periods'); setSelectedId(null) }}>Dos periodos</button>
          </div>

          {mode === 'sites' ? (
            <div className="control-stack">
              <label className="field"><span>Sitio A</span><select value={siteA} onChange={(event) => setSiteA(event.target.value)} disabled={!sites.length}>{sites.map((site) => <option key={site}>{site}</option>)}</select></label>
              <label className="field"><span>Sitio B</span><select value={siteB} onChange={(event) => setSiteB(event.target.value)} disabled={!sites.length}>{sites.map((site) => <option key={site}>{site}</option>)}</select></label>
              <div className="field-pair"><label className="field"><span>Desde · UTC</span><input type="datetime-local" step="1" value={range.startA} onChange={(event) => setDate('startA', event.target.value)} /></label><label className="field"><span>Hasta · UTC</span><input type="datetime-local" step="1" value={range.endA} onChange={(event) => setDate('endA', event.target.value)} /></label></div>
            </div>
          ) : (
            <div className="control-stack">
              <label className="field"><span>Sitio</span><select value={sameSite} onChange={(event) => setSameSite(event.target.value)} disabled={!sites.length}>{sites.map((site) => <option key={site}>{site}</option>)}</select></label>
              <div className="period-fields"><span className="period-name">Periodo A</span><div className="field-pair"><label className="field"><span>Desde · UTC</span><input type="datetime-local" step="1" value={range.startA} onChange={(event) => setDate('startA', event.target.value)} /></label><label className="field"><span>Hasta · UTC</span><input type="datetime-local" step="1" value={range.endA} onChange={(event) => setDate('endA', event.target.value)} /></label></div></div>
              <div className="period-fields"><span className="period-name">Periodo B</span><div className="field-pair"><label className="field"><span>Desde · UTC</span><input type="datetime-local" step="1" value={range.startB} onChange={(event) => setDate('startB', event.target.value)} /></label><label className="field"><span>Hasta · UTC</span><input type="datetime-local" step="1" value={range.endB} onChange={(event) => setDate('endB', event.target.value)} /></label></div></div>
            </div>
          )}

          <div className="source-control">
            <div><span className="source-label">Muestras</span><span className="source-name" title={fileName}>{fileName}</span></div>
            <label className="file-button">Elegir CSV<input type="file" accept=".csv,text/csv" onChange={(event) => loadFile(event.target.files?.[0])} /></label>
          </div>
          <p className="utc-note">Las fechas se leen como UTC. Cada fila del CSV representa el intervalo desde su inicio hasta su fin.</p>
        </aside>

        <section className="results-panel" aria-label="Resultados de comparación">
          <div className="results-heading">
            <div><h2>{mode === 'sites' ? `${siteA} frente a ${siteB}` : `${sameSite} · comparación temporal`}</h2></div>
            <span className="demo-badge"><span /> Datos sintéticos de demostración</span>
          </div>

          {loadError && <div className="notice error-notice" role="alert"><strong>No se pudo cargar la muestra.</strong><span>{loadError}</span><span>Elige un CSV válido para continuar.</span></div>}
          {!rows.length && !loadError && <div className="notice" role="status">Cargando las muestras…</div>}
          {comparison?.error && <div className="notice error-notice" role="alert"><strong>Revisa el periodo.</strong><span>{comparison.error}</span></div>}
          {comparison && !comparison.error && summaryA && summaryB && (
            <>
              <div className="summary-strip" aria-label="Resumen de resultados">
                {[{ label: titleA, summary: summaryA, tone: 'a' }, { label: titleB, summary: summaryB, tone: 'b' }].map(({ label, summary, tone }) => (
                  <div className={`summary-site summary-${tone}`} key={label}>
                    <h3><i />{label}</h3>
                    <dl><div><dt>Sol visible</dt><dd>{formatHours(summary.visible)} <small>h</small></dd></div><div><dt>Interrupciones</dt><dd>{summary.interruptions}</dd></div><div><dt>Indeterminado</dt><dd>{formatHours(summary.indeterminate)} <small>h</small></dd></div></dl>
                  </div>
                ))}
                <div className="coincidence-summary"><span>{mode === 'sites' ? 'Coincidencia' : 'Coincidencia por tiempo transcurrido'}</span><strong>{formatHours(comparison.match)} <small>h</small></strong><p>Ambos intervalos con Sol visible</p></div>
              </div>

              <section className="timeline-section" aria-labelledby="timeline-title">
                <div className="section-heading"><h3 id="timeline-title">Línea de tiempo</h3><div className="state-legend"><span><i className="legend-visible" />Visible</span><span><i className="legend-hidden" />Oculto</span><span><i className="legend-unknown" />Indeterminado</span></div></div>
                <div className="timeline-group">
                  <TimelineLane label={`${titleA} · visibilidad`} segments={comparison.a} start={comparison.startA} end={comparison.endA} selectedId={selectedId} onSelect={(segment) => setSelectedId(segment.id)} />
                  <AngleLane label={`${titleA} · ángulos locales`} segments={comparison.a} start={comparison.startA} end={comparison.endA} accent="var(--site-a)" onSelect={(segment) => setSelectedId(segment.id)} />
                  <TimelineLane label={`${titleB} · visibilidad`} segments={comparison.b} start={comparison.startB} end={comparison.endB} selectedId={selectedId} onSelect={(segment) => setSelectedId(segment.id)} />
                  <AngleLane label={`${titleB} · ángulos locales`} segments={comparison.b} start={comparison.startB} end={comparison.endB} accent="var(--site-b)" onSelect={(segment) => setSelectedId(segment.id)} />
                </div>
              </section>

              <section className="detail-section" aria-labelledby="detail-title">
                <div className="section-heading"><h3 id="detail-title">Detalle angular</h3><span className="detail-hint">Selecciona un tramo en la línea de tiempo</span></div>
                {selected ? (
                  <div className="detail-content">
                    <div className="detail-interval"><span className={`state-pill state-${selected.state}`}>{stateName(selected.state)}</span><span>{formatDate(selected.start)} — {formatDate(selected.end)} UTC</span></div>
                    <dl className="angle-values"><div><dt>Azimut solar</dt><dd>{selected.sunAzimuth === null ? '—' : `${selected.sunAzimuth.toFixed(2)}°`}</dd></div><div><dt>Elevación solar</dt><dd>{selected.sunElevation === null ? '—' : `${selected.sunElevation.toFixed(2)}°`}</dd></div><div><dt>Horizonte local</dt><dd>{selected.horizonElevation === null ? '—' : `${selected.horizonElevation.toFixed(2)}°`}</dd></div><div><dt>Margen sobre horizonte</dt><dd>{selected.sunElevation === null || selected.horizonElevation === null ? 'Indeterminado' : `${(selected.sunElevation - selected.horizonElevation).toFixed(2)}°`}</dd></div></dl>
                    <div className="provenance"><span>Fuente de efemérides: {selected.sunSource ?? 'no indicada en el CSV'}</span><span>Fuente de horizonte: {selected.horizonSource ?? 'no indicada en el CSV'}</span></div>
                  </div>
                ) : <p className="detail-empty">Al elegir un tramo verás azimut, elevación, horizonte y procedencia si el CSV la incluye.</p>}
              </section>

              <footer className="method-note"><span className="method-rule" />Visible si la elevación solar supera el horizonte local. Igualdad con el horizonte se clasifica como oculta; faltantes y huecos quedan indeterminados. Las interrupciones cuentan tramos ocultos dentro del periodo recortado.</footer>
            </>
          )}
        </section>
      </section>}
    </main>
  )
}

export default App
