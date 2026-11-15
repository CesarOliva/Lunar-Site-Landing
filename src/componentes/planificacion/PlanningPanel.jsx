import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Moon } from 'lucide-react'
import visibilitySite from '../../../Data_Structure/data/visibility-site.json'
import '../../estilos/planificacion/PlanningPanel.css'
import {
  CrewStep,
  ForecastStep,
  createDemoForecast,
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
    ...(missionProfile.conditionalSteps.length
      ? [{ id: 'mission-details', label: 'Configuración de misión' }]
      : []),
    { id: 'forecast', label: 'Fecha y entorno' },
    { id: 'analysis', label: 'Fecha y visibilidad' },
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
  const demoForecast = useMemo(
    () => createDemoForecast(form.dateTime, form.latitude, form.longitude),
    [form.dateTime, form.latitude, form.longitude],
  )

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
    if (currentStep.id === 'forecast' && !dateIsInCoverage) {
      setValidationMessage('Selecciona una fecha dentro del intervalo de datos disponible.')
      return
    }
    if (currentStep.id === 'analysis' && !comparisonDateIsInCoverage) {
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
      `Iluminación simulada: ${demoForecast?.illumination_hours ?? 'No disponible'} h en 24 h`,
      `Temperatura superficial simulada: ${demoForecast?.surface_temperature_c.minimum ?? '—'}° a ${demoForecast?.surface_temperature_c.maximum ?? '—'}°C`,
      `Índice demostrativo de radiación: ${demoForecast?.radiation_index_demo ?? '—'} / 5`,
      `Actividad simulada de micrometeoroides: ${demoForecast?.micrometeoroid_activity_demo ?? '—'}`,
      `Ventanas de comunicación simuladas: ${demoForecast?.communication_windows_demo ?? '—'} (${demoForecast?.communication_hours_demo ?? '—'} h)`,
      `Evaluación del terreno: ${demoForecast?.terrain_assessment ?? 'No disponible'}`,
      'Estos valores son ficticios y no representan un pronóstico, medición NASA ni evaluación de seguridad.',
      '',
      'VISIBILIDAD GEOMÉTRICA',
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
    setDownloaded(true)
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
            <DateStep form={form} update={update} dateIsInCoverage={dateIsInCoverage} />
            <ForecastStep forecast={demoForecast} />
          </div>
        )}

        {currentStep.id === 'analysis' && (
          <div className="planning-group">
            <VisibilityStep form={form} isModeledSite={isModeledSite} visibilityError={visibilityError} visibilitySamples={visibilitySamples} selectedSample={selectedSample} daySamples={daySamples} />
            <CompareStep form={form} update={update} isModeledSite={isModeledSite} visibilityError={visibilityError} visibilitySamples={visibilitySamples} comparisonSamples={comparisonSamples} />
          </div>
        )}

        {currentStep.id === 'summary' && (
          <SummaryStep form={form} missionProfile={missionProfile} isModeledSite={isModeledSite} selectedSample={selectedSample} visibilityError={visibilityError} demoForecast={demoForecast} downloaded={downloaded} downloadPlan={downloadPlan} />
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