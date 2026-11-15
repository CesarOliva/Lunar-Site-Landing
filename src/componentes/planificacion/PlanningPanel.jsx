import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Moon } from 'lucide-react'
import visibilitySite from '../../../data/visibility-site.json'
import '../../estilos/planificacion/PlanningPanel.css'
import {
  CrewStep,
  ForecastStep,
  getDurationIssue,
  initialForm,
  LogisticsStep,
  MissionStep,
  missionTypes,
  SampleStep,
  SiteStep,
  SummaryStep,
  VehicleStep,
} from './PlanningSteps'
import {
  CompareStep,
  DateStep,
  dateTimeMax,
  dateTimeMin,
  getDaySamples,
  getNearestSample,
  loadVisibilitySamples,
  VisibilityStep,
} from './PlanningVisibility'

const horizonsLongitude = (longitude) => ((longitude + 180) % 360 + 360) % 360 - 180
const visibilityKey = (latitude, longitude, altitude, date) => `${latitude}|${longitude}|${altitude}|${date}`

function parseVisibilityDay(result) {
  return {
    ...result,
    samples: result.samples.map((sample) => ({
      time: Date.parse(sample.time_utc),
      horizonBasis: result.horizon_basis,
      terrainReason: result.terrain.reason,
      sun: {
        azimuth: sample.sun.azimuth_deg,
        elevation: sample.sun.elevation_deg,
        terrain: sample.sun.terrain_horizon_deg ?? 0,
        difference: sample.sun.margin_deg,
        state: sample.sun.state,
      },
      earth: {
        azimuth: sample.earth.azimuth_deg,
        elevation: sample.earth.elevation_deg,
        terrain: sample.earth.terrain_horizon_deg ?? 0,
        difference: sample.earth.margin_deg,
        state: sample.earth.state,
      },
    })),
  }
}

function PlanningPanel() {
  const [step, setStep] = useState(0)
  const wizardRef = useRef(null)
  const [glitchActive, setGlitchActive] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [ambientGlitch, setAmbientGlitch] = useState(false)
  const glitchFrame = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [validationMessage, setValidationMessage] = useState('')
  const [visibilitySamples, setVisibilitySamples] = useState(null)
  const [visibilityError, setVisibilityError] = useState('')
  const [customVisibility, setCustomVisibility] = useState(null)
  const [visibilityRetry, setVisibilityRetry] = useState(0)
  const missionProfile = missionTypes.find((type) => type.id === form.missionType) ?? missionTypes[0]
  const steps = [
    { id: 'mission', label: 'Información general' },
    { id: 'vehicle', label: 'Vehículo y lanzamiento' },
    ...(missionProfile.conditionalSteps.length
      ? [{ id: 'mission-details', label: 'Configuración de misión' }]
      : []),
    { id: 'site', label: 'Ubicación lunar' },
    { id: 'forecast', label: 'Fecha y entorno' },
    { id: 'analysis', label: 'Fecha y visibilidad' },
    { id: 'summary', label: 'Resumen de misión' },
  ]
  const currentStep = steps[step] ?? steps[0]

  useEffect(() => {
    wizardRef.current?.closest('.side-panel')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep.id])

  const triggerGlitch = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (glitchFrame.current !== null) {
      window.cancelAnimationFrame(glitchFrame.current)
    }

    setGlitchActive(false)
    glitchFrame.current = window.requestAnimationFrame(() => {
      setGlitchActive(true)
      glitchFrame.current = null
    })
  }

  useEffect(() => {
    if (!glitchActive) return undefined

    const timer = window.setTimeout(() => setGlitchActive(false), 0)
    return () => window.clearTimeout(timer)
  }, [glitchActive])

  useEffect(() => () => {
    if (glitchFrame.current !== null) {
      window.cancelAnimationFrame(glitchFrame.current)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let glitchTimer
    const interval = window.setInterval(() => {
      setAmbientGlitch(true)
      glitchTimer = window.setTimeout(() => setAmbientGlitch(false), 500)
    }, 2500)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(glitchTimer)
    }
  }, [])

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
      payload: selectedType.payloads.includes(current.payload)
        ? current.payload
        : selectedType.payloads[0],
    }))
    setStep(0)
    setValidationMessage('')
  }

  const isModeledSite = form.site === 'site04'
  const latestFullQueryDayDate = new Date(Date.now() + 75 * 86400000)
  latestFullQueryDayDate.setUTCHours(0, 0, 0, 0)
  latestFullQueryDayDate.setUTCDate(latestFullQueryDayDate.getUTCDate() - 1)
  const latestFullQueryDay = `${latestFullQueryDayDate.toISOString().slice(0, 10)}T23:00`
  const planningDateMax = isModeledSite || dateTimeMax < latestFullQueryDay ? dateTimeMax : latestFullQueryDay

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
  const apiLatitude = Number(form.latitude)
  const apiLongitude = horizonsLongitude(Number(form.longitude))
  const apiAltitude = Number(form.elevation)
  const visibilityDates = [...new Set([form.dateTime.slice(0, 10), form.compareDate].filter(Boolean))]
  const customRequestKey = JSON.stringify([
    apiLatitude.toFixed(6), apiLongitude.toFixed(6), apiAltitude.toFixed(1), ...visibilityDates,
  ])

  useEffect(() => {
    if (!['forecast', 'analysis'].includes(currentStep.id) || isModeledSite || !coordinatesValid || !altitudeValid) return undefined
    if (customVisibility?.key === customRequestKey && !customVisibility.loading) return undefined

    const controller = new AbortController()
    let active = true
    setCustomVisibility({ key: customRequestKey, days: {}, loading: true, error: '' })
    const timer = window.setTimeout(async () => {
      const results = await Promise.allSettled(visibilityDates.map(async (date) => {
        const response = await fetch('/api/visibility-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            latitude_deg: apiLatitude,
            longitude_deg: apiLongitude,
            altitude_m: apiAltitude,
            time_utc: `${date}T00:00:00Z`,
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? `Error de consulta (${response.status}).`)
        return [date, parseVisibilityDay(result)]
      }))
      if (!active) return
      const days = {}
      const errors = []
      results.forEach((result) => {
        if (result.status === 'fulfilled') days[result.value[0]] = result.value[1]
        else if (result.reason?.name !== 'AbortError') errors.push(result.reason instanceof Error ? result.reason.message : 'No se pudo calcular la visibilidad.')
      })
      setCustomVisibility({ key: customRequestKey, days, loading: false, error: errors.join(' ') })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [currentStep.id, isModeledSite, coordinatesValid, altitudeValid, apiLatitude, apiLongitude, apiAltitude, customRequestKey, visibilityRetry])

  const currentCustomVisibility = customVisibility?.key === customRequestKey ? customVisibility : null
  const customDays = currentCustomVisibility?.days ?? {}
  const selectedDate = form.dateTime.slice(0, 10)
  const selectedDay = customDays[selectedDate]
  const selectedSample = useMemo(() => (
    isModeledSite
      ? getNearestSample(visibilitySamples, form.dateTime)
      : getNearestSample(selectedDay?.samples, form.dateTime)
  ), [form.dateTime, isModeledSite, selectedDay, visibilitySamples])
  const daySamples = useMemo(() => (
    isModeledSite
      ? getDaySamples(visibilitySamples, selectedDate)
      : selectedDay?.samples ?? []
  ), [form.dateTime, isModeledSite, selectedDate, selectedDay, visibilitySamples])
  const comparisonSamples = useMemo(() => {
    const time = form.dateTime.slice(11, 16)
    if (isModeledSite) {
      return [
        getNearestSample(visibilitySamples, `${selectedDate}T${time}`),
        getNearestSample(visibilitySamples, `${form.compareDate}T${time}`),
      ]
    }
    return [
      getNearestSample(selectedDay?.samples, `${selectedDate}T${time}`),
      getNearestSample(customDays[form.compareDate]?.samples, `${form.compareDate}T${time}`),
    ]
  }, [customDays, form.compareDate, form.dateTime, isModeledSite, selectedDate, selectedDay, visibilitySamples])
  const activeVisibilityError = isModeledSite ? visibilityError : currentCustomVisibility?.error ?? ''
  const activeVisibilityLoading = isModeledSite
    ? visibilitySamples === null && !visibilityError
    : ['forecast', 'analysis'].includes(currentStep.id) && coordinatesValid && altitudeValid && Boolean(currentCustomVisibility?.loading || !currentCustomVisibility)
  const activeVisibilitySamples = isModeledSite ? visibilitySamples : selectedDay?.samples ?? null
  const retryVisibility = () => {
    setCustomVisibility(null)
    setVisibilityRetry((current) => current + 1)
  }

  const dateIsInCoverage = form.dateTime >= dateTimeMin && form.dateTime <= planningDateMax
  const comparisonDateIsInCoverage =
    form.compareDate >= dateTimeMin.slice(0, 10) &&
    form.compareDate <= planningDateMax.slice(0, 10)

  const goNext = () => {
    if (currentStep.id === 'mission' && !form.name.trim()) {
      setValidationMessage('Escribe un nombre para la misión antes de continuar.')
      return
    }
    if (currentStep.id === 'mission' && getDurationIssue(form)) {
      setValidationMessage(getDurationIssue(form))
      return
    }
    if (currentStep.id === 'site' && !siteInputsValid) {
      setValidationMessage('Revisa latitud, longitud y altitud del sitio antes de continuar.')
      return
    }
    if (currentStep.id === 'forecast' && !dateIsInCoverage) {
      setValidationMessage('Selecciona una fecha dentro del intervalo de datos disponible.')
      return
    }
    if (currentStep.id === 'analysis' && !comparisonDateIsInCoverage) {
      setValidationMessage('Selecciona una fecha alternativa dentro del intervalo de datos.')
      return
    }
    setValidationMessage('')
    if (currentStep.id !== 'analysis') triggerGlitch()
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const downloadPlan = () => {
    if (!form.name.trim() || getDurationIssue(form) || !siteInputsValid || !dateIsInCoverage || !comparisonDateIsInCoverage) {
      setValidationMessage('Revisa el nombre, duración, coordenadas y fechas antes de descargar el plan.')
      return
    }
    const text = [
      'PLAN DE MISIÓN LUNAR',
      '====================',
      '',
      'MISIÓN',
      `Nombre: ${form.name.trim()}`,
      `Perfil: ${missionProfile.label}`,
      `Objetivo: ${form.objective}`,
      `Duración seleccionada: ${form.duration}`,
      `Requisitos considerados: ${missionProfile.requirements.join(', ')}`,
      '',
      'VEHÍCULO Y LANZAMIENTO',
      `Lanzador/configuración: ${form.vehicle || 'Sin definir'}`,
      `Masa de carga útil: ${form.mass ? `${form.mass} kg` : 'Sin definir'}`,
      `Lugar: ${form.launchSite}`,
      `Carga útil: ${form.payload}`,
      `Propulsión: ${form.propulsion}`,
      `Ventana de lanzamiento (referencia): ${form.launchWindow}`,
      'Nota: el antecedente de un lugar no confirma disponibilidad ni compatibilidad.',
      '',
      'SITIO LUNAR',
      `Sitio: ${isModeledSite ? visibilitySite.name : 'Coordenadas personalizadas'}`,
      `Latitud: ${Number(form.latitude)}°`,
      `Longitud este: ${Number(form.longitude)}°`,
      `Elevación: ${Number(form.elevation)} m`,
      `Área de aterrizaje: ${form.landingArea}`,
      `Pendiente máxima seleccionada: ${form.maxSlope}`,
      '',
      'FECHA Y HORA',
      `Escenario de aterrizaje: ${form.dateTime.replace('T', ' ')} UTC`,
      `Fecha alternativa: ${form.compareDate} ${form.dateTime.slice(11, 16)} UTC`,
      '',
      'ENTORNO Y RIESGOS (SIMULACIÓN FICTICIA)',
      'Estos valores son ficticios y no representan un pronóstico, medición NASA ni evaluación de seguridad.',
      '',
      'VISIBILIDAD GEOMÉTRICA',
      `Base del horizonte: ${selectedSample?.horizonBasis === 'geometric' ? 'geométrico; relieve LOLA indeterminado' : 'perfil topográfico LOLA'}`,
      selectedSample
        ? `Sol: ${selectedSample.sun.state === 'visible' ? 'visible' : 'oculto'}, elevación ${selectedSample.sun.elevation.toFixed(1)}°`
        : 'Sol: sin datos calculados para este escenario.',
      selectedSample
        ? `Tierra: ${selectedSample.earth.state === 'visible' ? 'visible' : 'oculta'}, elevación ${selectedSample.earth.elevation.toFixed(1)}°`
        : 'Tierra: sin datos calculados para este escenario.',
      comparisonSamples[1]
        ? `Escenario alternativo (${form.compareDate}): Sol ${comparisonSamples[1].sun.state === 'visible' ? 'visible' : 'oculto'}; Tierra ${comparisonSamples[1].earth.state === 'visible' ? 'visible' : 'oculta'}.`
        : 'Escenario alternativo: sin datos calculados.',
      'La visibilidad geométrica no estima generación eléctrica ni calidad del enlace de comunicaciones.',
      '',
      'CONFIGURACIÓN CONDICIONAL',
      ...(missionProfile.conditionalSteps.includes('crew')
        ? [`Tripulación: ${form.crewSize}`, `Plan EVA: ${form.evaPlan}`, `Soporte vital: ${form.lifeSupport}`, `Control ambiental: ${form.habitatControl}`]
        : []),
      ...(missionProfile.conditionalSteps.includes('logistics')
        ? [`Suministros: ${form.supplies}`, `Redundancia energética: ${form.redundancy}`, `ISRU: ${form.isru}`]
        : []),
      ...(missionProfile.conditionalSteps.includes('sample')
        ? [`Material objetivo: ${form.sampleTarget}`, `Recolección: ${form.sampleCollection}`, `Sistema de retorno: ${form.sampleReturn}`]
        : []),
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plan-lunar.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div ref={wizardRef} className={`planning-wizard ${glitchActive ? 'is-glitching' : ''} ${ambientGlitch ? 'is-ambient-glitching' : ''}`}>
      <header className="planning-brand">
        <div className="planning-wordmark"><Moon size={18} /><span>moonapp</span></div>
      </header>

      <nav className="planning-stepper" aria-label="Pasos de planificación" style={{ '--progress': steps.length > 1 ? step / (steps.length - 1) : 0 }}>
        {steps.map(({ label }, index) => (
          <button
            className={`step-number ${index === step ? 'is-current' : ''} ${index < step ? 'is-complete' : ''}`}
            key={steps[index].id}
            type="button"
            aria-label={`Paso ${index + 1}: ${label}`}
            title={label}
            aria-current={index === step ? 'step' : undefined}
            onClick={() => {
              if (index !== step && steps[index].id !== 'summary') triggerGlitch()
              setStep(index)
              setValidationMessage('')
            }}
          >
            {index < step ? <Check size={14} /> : index + 1}
          </button>
        ))}
      </nav>

      <main className="planning-content">
        {currentStep.id === 'mission' && (
          <MissionStep form={form} missionProfile={missionProfile} update={update} selectMissionType={selectMissionType} />
        )}

        {currentStep.id === 'vehicle' && (
          <VehicleStep form={form} missionProfile={missionProfile} update={update} />
        )}

        {currentStep.id === 'site' && (
          <SiteStep form={form} update={update} updateCoordinate={updateCoordinate} coordinatesValid={coordinatesValid} altitudeValid={altitudeValid} siteInputsValid={siteInputsValid} />
        )}

        {currentStep.id === 'mission-details' && (
          <div className="planning-group">
            {missionProfile.conditionalSteps.includes('crew') && (
              <CrewStep form={form} update={update} />
            )}
            {missionProfile.conditionalSteps.includes('logistics') && (
              <LogisticsStep form={form} update={update} />
            )}
            {missionProfile.conditionalSteps.includes('sample') && (
              <SampleStep form={form} update={update} />
            )}
          </div>
        )}

        {currentStep.id === 'forecast' && (
          <div className="planning-group">
            <DateStep form={form} update={update} dateIsInCoverage={dateIsInCoverage} maxDateTime={planningDateMax} />
            <ForecastStep samples={daySamples} loading={isModeledSite ? visibilitySamples === null && !visibilityError : Boolean(currentCustomVisibility?.loading || !currentCustomVisibility)} error={isModeledSite ? visibilityError : currentCustomVisibility?.error} />
          </div>
        )}

        {currentStep.id === 'analysis' && (
          <div className="planning-group">
            <VisibilityStep form={form} isModeledSite={isModeledSite} visibilityError={activeVisibilityError} visibilityLoading={activeVisibilityLoading} visibilitySamples={activeVisibilitySamples} selectedSample={selectedSample} daySamples={daySamples} onRetry={retryVisibility} />
            <CompareStep form={form} update={update} isModeledSite={isModeledSite} maxDateTime={planningDateMax} visibilityError={activeVisibilityError} visibilityLoading={activeVisibilityLoading} visibilitySamples={activeVisibilitySamples} comparisonSamples={comparisonSamples} onRetry={retryVisibility} />
          </div>
        )}

        {currentStep.id === 'summary' && (
          <SummaryStep form={form} missionProfile={missionProfile} isModeledSite={isModeledSite} selectedSample={selectedSample} visibilityError={activeVisibilityError} downloadPlan={downloadPlan} />
        )}

        <footer className="planning-navigation">
          {validationMessage && <p className="planning-error" role="alert">{validationMessage}</p>}
          <button className="planning-back-button" type="button" onClick={() => {
            if (step > 0) triggerGlitch()
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
