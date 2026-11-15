import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
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
  formatAngle,
  VisibilityStep,
} from './PlanningVisibility'

const horizonsLongitude = (longitude) => ((longitude + 180) % 360 + 360) % 360 - 180
const visibilityKey = (latitude, longitude, altitude, date) => `${latitude}|${longitude}|${altitude}|${date}`
const DETAILED_PLAN_CREDITS = 5
const FREE_STEP_IDS = new Set(['mission', 'site', 'forecast', 'summary'])

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

function PlanningPanel({ creditsBalance, onSpendCredits }) {
  const [step, setStep] = useState(0)
  const wizardRef = useRef(null)
  const unlockDialogRef = useRef(null)
  const unlockTriggerRef = useRef(null)
  const [glitchActive, setGlitchActive] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const glitchFrame = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [validationMessage, setValidationMessage] = useState('')
  const [visibilitySamples, setVisibilitySamples] = useState(null)
  const [visibilityError, setVisibilityError] = useState('')
  const [customVisibility, setCustomVisibility] = useState(null)
  const [visibilityRetry, setVisibilityRetry] = useState(0)
  const [detailedPlan, setDetailedPlan] = useState(false)
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [planNotice, setPlanNotice] = useState('')
  const missionProfile = missionTypes.find((type) => type.id === form.missionType) ?? missionTypes[0]
  const steps = [
    { id: 'mission', label: 'Planeación de viaje' },
    { id: 'vehicle', label: 'Vehículo y lanzamiento' },
    ...(missionProfile.conditionalSteps.length
      ? [{ id: 'mission-details', label: 'Configuración de misión' }]
      : []),
    { id: 'site', label: 'Sitio de aterrizaje' },
    { id: 'forecast', label: 'Fecha y hora' },
    { id: 'analysis', label: 'Fecha y visibilidad' },
    { id: 'summary', label: 'Resumen de misión' },
  ]
  const isStepAvailable = (stepDefinition) => detailedPlan || FREE_STEP_IDS.has(stepDefinition.id)
  const findNextAvailableStep = (index) => steps.findIndex(
    (stepDefinition, stepIndex) => stepIndex > index && isStepAvailable(stepDefinition),
  )
  const findPreviousAvailableStep = (index) => {
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (isStepAvailable(steps[previous])) return previous
    }
    return 0
  }
  const currentStep = steps[step] ?? steps[0]
  const nextAvailableStep = findNextAvailableStep(step)

  useEffect(() => {
    wizardRef.current?.closest('.side-panel')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep.id])

  useEffect(() => {
    const dialog = unlockDialogRef.current
    if (!dialog) return

    if (unlockDialogOpen && !dialog.open) {
      dialog.showModal()
      dialog.querySelector('.planning-unlock-confirm')?.focus()
    } else if (!unlockDialogOpen && dialog.open) {
      dialog.close()
      if (unlockTriggerRef.current?.isConnected) unlockTriggerRef.current.focus()
      else wizardRef.current?.querySelector('[aria-current="step"]')?.focus()
    }
  }, [unlockDialogOpen])

  const openDetailedPlanDialog = (event) => {
    unlockTriggerRef.current = event.currentTarget
    setPurchaseError('')
    setUnlockDialogOpen(true)
  }

  const confirmDetailedPlan = () => {
    if (creditsBalance < DETAILED_PLAN_CREDITS) {
      setPurchaseError(`Necesitas ${DETAILED_PLAN_CREDITS} créditos y tu saldo actual es de ${creditsBalance}.`)
      return
    }
    if (!onSpendCredits(DETAILED_PLAN_CREDITS)) {
      setPurchaseError(`No se pudo completar la compra. Necesitas ${DETAILED_PLAN_CREDITS} créditos disponibles.`)
      return
    }

    setDetailedPlan(true)
    setPlanNotice(`Plan detallado activado para esta misión. Saldo restante: ${creditsBalance - DETAILED_PLAN_CREDITS} créditos.`)
    setPurchaseError('')
    setUnlockDialogOpen(false)
  }

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
    if (nextAvailableStep !== -1) setStep(nextAvailableStep)
  }

  const downloadPlan = async () => {
    if (!form.name.trim() || getDurationIssue(form) || !siteInputsValid || !dateIsInCoverage || !comparisonDateIsInCoverage) {
      setValidationMessage('Revisa el nombre, duración, coordenadas y fechas antes de descargar el plan.')
      return
    }
    setValidationMessage('')
    try {
      const { downloadMissionPlanPdf } = await import('./downloadMissionPlanPdf.js')
      await downloadMissionPlanPdf({
        form,
        missionProfile,
        siteName: isModeledSite ? visibilitySite.name : 'Coordenadas personalizadas',
        selectedSample,
        formatAngle,
      })
    } catch (error) {
      setValidationMessage(
        `No se pudo generar el PDF: ${error instanceof Error ? error.message : 'error inesperado.'}`
      )
    }
  }

  return (
    <div ref={wizardRef} className={`planning-wizard ${glitchActive ? 'is-glitching' : ''}`}>
      <nav className="planning-stepper" aria-label="Pasos de planificación" style={{ '--progress': steps.length > 1 ? step / (steps.length - 1) : 0 }}>
        {steps.map(({ label }, index) => (
          <button
            className={`step-number ${index === step ? 'is-current' : ''} ${index < step && isStepAvailable(steps[index]) ? 'is-complete' : ''} ${isStepAvailable(steps[index]) ? '' : 'is-locked'}`}
            key={steps[index].id}
            type="button"
            disabled={!isStepAvailable(steps[index])}
            aria-label={`Paso ${index + 1}: ${label}${isStepAvailable(steps[index]) ? '' : ', bloqueado en el plan gratuito'}`}
            title={isStepAvailable(steps[index]) ? label : `${label} · Requiere plan detallado`}
            aria-current={index === step ? 'step' : undefined}
            onClick={() => {
              if (!isStepAvailable(steps[index])) return
              if (index !== step && steps[index].id !== 'summary') triggerGlitch()
              setStep(index)
              setValidationMessage('')
            }}
          >
            {!isStepAvailable(steps[index])
              ? <Lock size={14} />
              : index < step
                ? <Check size={14} />
                : index + 1}
          </button>
        ))}
      </nav>

      <main className="planning-content">
        {currentStep.id === 'mission' && (
          <MissionStep
            form={form}
            missionProfile={missionProfile}
            update={update}
            selectMissionType={selectMissionType}
            detailedPlan={detailedPlan}
            onOpenDetailedPlan={openDetailedPlanDialog}
            planNotice={planNotice}
          />
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
          <SummaryStep
            form={form}
            missionProfile={missionProfile}
            isModeledSite={isModeledSite}
            selectedSample={selectedSample}
            visibilityError={activeVisibilityError}
            downloadPlan={downloadPlan}
            detailedPlan={detailedPlan}
          />
        )}

        <footer className="planning-navigation">
          {validationMessage && <p className="planning-error" role="alert">{validationMessage}</p>}
          <button className="planning-back-button" type="button" onClick={() => {
            if (step > 0) triggerGlitch()
            setStep(findPreviousAvailableStep(step))
            setValidationMessage('')
          }} disabled={step === 0}>
            <ChevronLeft size={16} /> Anterior
          </button>
          {nextAvailableStep !== -1 && (
            <button className="planning-next-button" type="button" onClick={goNext}>
              Siguiente <ChevronRight size={16} />
            </button>
          )}
        </footer>
      </main>
      <dialog
        className="planning-unlock-dialog"
        ref={unlockDialogRef}
        aria-labelledby="planning-unlock-title"
        onCancel={(event) => {
          event.preventDefault()
          setUnlockDialogOpen(false)
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setUnlockDialogOpen(false)
        }}
      >
        <div className="planning-unlock-content">
          <p className="planning-unlock-eyebrow">DESBLOQUEO POR PLAN</p>
          <h3 id="planning-unlock-title">Plan detallado</h3>
          <p className="planning-unlock-description">
            Por 5 créditos ($2.50 USD) obtienes, para esta planeación:
          </p>
          <ul className="planning-unlock-benefits">
            <li>Edición de todos los pasos y sus detalles.</li>
            <li>Simulación final de la misión.</li>
            <li>Descarga en PDF del resumen de misión.</li>
          </ul>
          <p className="planning-unlock-balance">
            Saldo actual: <strong>{creditsBalance} créditos</strong>
          </p>
          <p className="planning-unlock-once">
            La compra desbloquea solo este plan. Cada nuevo plan detallado cuesta otros 5 créditos.
          </p>
          {creditsBalance < DETAILED_PLAN_CREDITS && (
            <p className="planning-unlock-error" role="status">
              Saldo insuficiente: necesitas {DETAILED_PLAN_CREDITS - creditsBalance} créditos más para continuar.
            </p>
          )}
          {purchaseError && <p className="planning-unlock-error" role="alert">{purchaseError}</p>}
          <div className="planning-unlock-actions">
            <button
              className="planning-unlock-confirm"
              type="button"
              onClick={confirmDetailedPlan}
              disabled={creditsBalance < DETAILED_PLAN_CREDITS}
            >
              Comprar por 5 créditos
            </button>
            <button className="planning-unlock-cancel" type="button" onClick={() => setUnlockDialogOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}

export default PlanningPanel
