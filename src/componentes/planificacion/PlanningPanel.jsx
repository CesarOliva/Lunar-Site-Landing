import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Moon } from 'lucide-react'
import visibilitySite from '../../../Data_Structure/data/visibility-site.json'
import '../../estilos/planificacion/PlanningPanel.css'
import {
  CrewStep,
  EnvironmentStep,
  initialForm,
  LogisticsStep,
  MissionStep,
  missionTypes,
  RiskStep,
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

        {currentStep.id === 'crew' && (
          <CrewStep form={form} update={update} />
        )}

        {currentStep.id === 'logistics' && (
          <LogisticsStep form={form} update={update} />
        )}

        {currentStep.id === 'sample' && (
          <SampleStep form={form} update={update} />
        )}

        {currentStep.id === 'date' && (
          <DateStep form={form} update={update} dateIsInCoverage={dateIsInCoverage} />
        )}

        {currentStep.id === 'environment' && (
          <EnvironmentStep form={form} update={update} />
        )}

        {currentStep.id === 'risk' && (
          <RiskStep form={form} update={update} missionProfile={missionProfile} />
        )}

        {currentStep.id === 'visibility' && (
          <VisibilityStep form={form} isModeledSite={isModeledSite} visibilityError={visibilityError} visibilitySamples={visibilitySamples} selectedSample={selectedSample} daySamples={daySamples} />
        )}

        {currentStep.id === 'compare' && (
          <CompareStep form={form} update={update} isModeledSite={isModeledSite} visibilityError={visibilityError} visibilitySamples={visibilitySamples} comparisonSamples={comparisonSamples} />
        )}

        {currentStep.id === 'summary' && (
          <SummaryStep form={form} missionProfile={missionProfile} isModeledSite={isModeledSite} selectedSample={selectedSample} visibilityError={visibilityError} downloaded={downloaded} downloadPlan={downloadPlan} />
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