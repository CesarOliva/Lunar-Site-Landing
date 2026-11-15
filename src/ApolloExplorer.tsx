import { type FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import {
  DoubleSide,
  Group,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three'
import { OrbitControls as ThreeOrbitControls } from 'three/addons/controls/OrbitControls.js'
import missionCatalog from '../data/apollo_sites.json'
import sceneCatalog from '../data/apollo_scenes.json'

type Mission = (typeof missionCatalog.missions)[number]
type MissionId = keyof typeof sceneCatalog.missions
type SceneBody = {
  azimuth_deg: number
  elevation_deg: number
  direction_me: number[]
  above_geometric_horizon: boolean
  terrain_visibility: string
  source?: string
}
type LandingAssessmentData = {
  status: 'favorable' | 'unfavorable' | 'indeterminate'
  status_label: string
  coverage: string
  source?: string
  source_label?: string
  reason?: string
  max_slope_deg?: number
  slope_limit_deg?: number
  landing_area_diameter_m?: number
  profile_radius_km?: number
  sun_horizon_deg?: number
  sun_visible_over_terrain?: boolean
  earth_horizon_deg?: number
  earth_visible_over_terrain?: boolean
  resolution_m?: number
  coordinate_frame?: string
  limitations?: string[]
}
type Scene = {
  site: { latitude_deg: number; longitude_deg: number; altitude_km?: number }
  time_utc: string
  sun: SceneBody
  earth: SceneBody
  ephemeris_source?: string
  response_frame?: string
  coordinate_frame?: string
  cached?: boolean
  landing_assessment?: LandingAssessmentData
}
type CustomScene = Scene & { cached: boolean }
const missions = missionCatalog.missions as Mission[]
const defaultMission = missions[0]

function vectorFromME(vector: number[]): Vector3 {
  return new Vector3(vector[0], vector[2], -vector[1]).normalize()
}

function sitePosition(latitude: number, longitude: number, radius = 1.009): Vector3 {
  const lat = latitude * Math.PI / 180
  const lon = longitude * Math.PI / 180
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).multiplyScalar(radius)
}

function MissionMarker({ mission, active, onSelect }: { mission: Mission; active: boolean; onSelect: () => void }) {
  const position = useMemo(() => sitePosition(mission.latitude_deg, mission.longitude_deg), [mission.latitude_deg, mission.longitude_deg])
  const normal = useMemo(() => position.clone().normalize(), [position])
  const ringRotation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal), [normal])
  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <mesh><sphereGeometry args={[active ? 0.012 : 0.008, 16, 12]} /><meshBasicMaterial color={active ? '#e4a568' : '#a9c7c5'} toneMapped={false} /></mesh>
      {active && <mesh position={normal.clone().multiplyScalar(0.012)} quaternion={ringRotation}><ringGeometry args={[0.016, 0.021, 32]} /><meshBasicMaterial color="#e4a568" side={DoubleSide} toneMapped={false} /></mesh>}
    </group>
  )
}

function CustomMarker({ latitude, longitude }: { latitude: number; longitude: number }) {
  const position = useMemo(() => sitePosition(latitude, longitude), [latitude, longitude])
  const normal = useMemo(() => position.clone().normalize(), [position])
  const ringRotation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal), [normal])
  return <group position={position}><mesh><sphereGeometry args={[0.012, 16, 12]} /><meshBasicMaterial color="#f0a66e" toneMapped={false} /></mesh><mesh position={normal.clone().multiplyScalar(0.012)} quaternion={ringRotation}><ringGeometry args={[0.016, 0.021, 32]} /><meshBasicMaterial color="#f0a66e" side={DoubleSide} toneMapped={false} /></mesh></group>
}

function CameraControls() {
  const { camera, gl, size } = useThree()
  const controls = useMemo(() => new ThreeOrbitControls(camera, gl.domElement), [camera, gl])
  useEffect(() => {
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.065
    controls.minDistance = 1.65
    controls.rotateSpeed = 0.55
    controls.zoomSpeed = 0.7
    controls.target.set(0, 0, 0)
    const aspect = size.width / Math.max(size.height, 1)
    const fitDistance = Math.max(3.6, 1.06 / (Math.tan(35 * Math.PI / 360) * Math.min(1, aspect)))
    controls.maxDistance = fitDistance + 0.7
    camera.position.set(0, 0, fitDistance)
    controls.listenToKeyEvents(window)
    controls.update()
    return () => { controls.stopListenToKeyEvents(); controls.dispose() }
  }, [camera, controls, size.height, size.width])
  useFrame(() => controls.update())
  return null
}

function Moon() {
  const texture = useLoader(TextureLoader, '/assets/lroc_color_2k.jpg')
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return <mesh><sphereGeometry args={[1, 128, 96]} /><meshStandardMaterial map={texture} roughness={1} metalness={0} /></mesh>
}

function GlobeScene({ site, scene, selectedId, onSelect }: { site: Scene['site']; scene: Scene; selectedId: string | null; onSelect: (id: string) => void }) {
  const group = useRef<Group>(null)
  const { camera } = useThree()
  const destination = useMemo(() => {
    const location = sitePosition(site.latitude_deg, site.longitude_deg, 1).normalize()
    return new Quaternion().setFromUnitVectors(location, camera.position.clone().normalize())
  }, [site.latitude_deg, site.longitude_deg, camera])
  const [reducedMotion, setReducedMotion] = useState(false)
  const lightTarget = useMemo(() => new Object3D(), [])
  const lightDirection = useMemo(() => vectorFromME(scene.sun.direction_me), [scene.sun.direction_me])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useFrame((_, delta) => {
    if (group.current) group.current.quaternion.slerp(destination, reducedMotion ? 1 : 1 - Math.exp(-5 * delta))
  })

  return <>
    <color attach="background" args={['#151919']} />
    <ambientLight intensity={0.075} />
    <group ref={group}>
      <primitive object={lightTarget} />
      <directionalLight target={lightTarget} position={lightDirection.clone().multiplyScalar(5)} intensity={2.3} />
      <Moon />
      {missions.map((entry) => <MissionMarker key={entry.id} mission={entry} active={entry.id === selectedId} onSelect={() => onSelect(entry.id)} />)}
      {selectedId === null && <CustomMarker latitude={site.latitude_deg} longitude={site.longitude_deg} />}
    </group>
    <CameraControls />
  </>
}

function formatTime(value: string) {
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(date),
    time: value.slice(11, 19),
  }
}

function formatAngle(value: number) { return `${value.toFixed(2)}°` }

function AngleReadout({ title, body }: { title: string; body: SceneBody }) {
  return <section className="mission-angle">
    <h3>{title}</h3>
    <dl><div><dt>Azimut</dt><dd>{formatAngle(body.azimuth_deg)}</dd></div><div><dt>Elevación</dt><dd>{formatAngle(body.elevation_deg)}</dd></div></dl>
    <p className="geometric-state"><span />{body.above_geometric_horizon ? 'Sobre el horizonte geométrico' : 'Bajo el horizonte geométrico'}</p>
    <p className="terrain-state">Visibilidad con relieve: <strong>{body.terrain_visibility === 'visible' ? 'visible' : body.terrain_visibility === 'blocked' ? 'bloqueada' : 'indeterminada'}</strong></p>
  </section>
}

function LandingAssessment({ scene }: { scene: Scene }) {
  const assessment = scene.landing_assessment
  const checks = assessment?.coverage === 'available'
  const sunVisible = checks && assessment.sun_visible_over_terrain
  const earthVisible = checks && assessment.earth_visible_over_terrain
  const passSlope = checks && assessment.max_slope_deg !== undefined && assessment.slope_limit_deg !== undefined && assessment.max_slope_deg <= assessment.slope_limit_deg

  return <section className="landing-assessment" aria-labelledby="landing-assessment-title">
    <div className="assessment-heading">
      <div><p>Evaluación puntual</p><h3 id="landing-assessment-title">¿Buen lugar para aterrizar?</h3></div>
      <span className={`assessment-verdict is-${assessment?.status ?? 'indeterminate'}`}>{assessment?.status_label ?? 'Indeterminado'}</span>
    </div>
    {checks ? <>
      <div className={`geometry-result${assessment.status === 'favorable' ? ' is-positive' : ' is-constrained'}`}>
        <strong>Perfil base de cribado</strong>
        <p>Pendiente máxima {assessment.max_slope_deg?.toFixed(2)}°; límite {assessment.slope_limit_deg?.toFixed(1)}° en un área de {assessment.landing_area_diameter_m} m. Horizonte del terreno calculado hasta {assessment.profile_radius_km} km.</p>
      </div>
      <div className="assessment-checks">
        <p className={passSlope ? 'check-pass' : 'check-fail'}><strong>Pendiente</strong><span>{passSlope ? 'Pasa' : 'No pasa'} · {assessment.max_slope_deg?.toFixed(2)}° / {assessment.slope_limit_deg?.toFixed(1)}°</span></p>
        <p className={sunVisible ? 'check-pass' : 'check-fail'}><strong>Sol sobre relieve</strong><span>{sunVisible ? 'Visible' : 'Bloqueado'} · horizonte {assessment.sun_horizon_deg?.toFixed(2)}°</span></p>
        <p className={earthVisible ? 'check-pass' : 'check-fail'}><strong>Tierra sobre relieve</strong><span>{earthVisible ? 'Visible' : 'Bloqueada'} · horizonte {assessment.earth_horizon_deg?.toFixed(2)}°</span></p>
      </div>
      {assessment.limitations && <details className="assessment-limitations"><summary>Alcance y limitaciones</summary><ul>{assessment.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>}
      {assessment.source_label && <a className="assessment-source" href={assessment.source_label} target="_blank" rel="noreferrer">Label y procedencia del DEM LOLA ({assessment.resolution_m} m/píxel)</a>}
    </> : <>
      <div className="geometry-result is-constrained"><strong>Faltan datos para evaluarlo</strong><p>{assessment?.reason ?? 'Esta escena no tiene un perfil topográfico evaluado. Envía sus coordenadas como consulta personalizada.'}</p></div>
      <p className="assessment-footnote">{assessment?.reason ?? 'La evaluación requiere cobertura LOLA local para esta posición.'}</p>
    </>}
    <a className="assessment-source" href="https://ntrs.nasa.gov/api/citations/20250003508/downloads/HLS-CONOP-008_Sustained_Phase_HLS_RF_ConOps_Rev_A.pdf?attachment=true" target="_blank" rel="noreferrer">Base del límite de pendiente: preferencia HLS NASA de 5°; no es un requisito universal</a>
  </section>
}

function toUtcIso(localValue: string) {
  if (!localValue) return ''
  return `${localValue.length === 16 ? `${localValue}:00` : localValue}Z`
}

export default function ApolloExplorer() {
  const [selectedId, setSelectedId] = useState<string | null>(defaultMission.id)
  const [customScene, setCustomScene] = useState<CustomScene | null>(null)
  const [latitude, setLatitude] = useState(String(defaultMission.latitude_deg))
  const [longitude, setLongitude] = useState(String(defaultMission.longitude_deg))
  const [dateTime, setDateTime] = useState(defaultMission.landing_time_utc.slice(0, 19))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const mission = missions.find((entry) => entry.id === selectedId)
  const scene = customScene ?? sceneCatalog.missions[(selectedId ?? defaultMission.id) as MissionId] as Scene
  const site = customScene?.site ?? { latitude_deg: mission?.latitude_deg ?? defaultMission.latitude_deg, longitude_deg: mission?.longitude_deg ?? defaultMission.longitude_deg }
  const landing = formatTime(scene.time_utc)
  const alternative = mission && 'time_alternative' in mission.sources ? mission.sources.time_alternative : null
  const maxDateTime = new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)

  async function submitCustomScene(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude_deg: Number(latitude), longitude_deg: Number(longitude), time_utc: toUtcIso(dateTime) }),
      })
      const result = await response.json() as CustomScene & { error?: string }
      if (!response.ok) throw new Error(result.error ?? `Error de consulta (${response.status}).`)
      setCustomScene(result)
      setSelectedId(null)
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'No se pudo consultar Horizons.')
    } finally {
      setLoading(false)
    }
  }

  function selectMission(id: string) {
    const selected = missions.find((entry) => entry.id === id)
    setSelectedId(id)
    setCustomScene(null)
    if (selected) {
      setLatitude(String(selected.latitude_deg))
      setLongitude(String(selected.longitude_deg))
      setDateTime(selected.landing_time_utc.slice(0, 19))
    }
    setError('')
  }

  return <main className="apollo-page">
    <div className="apollo-heading">
      <div><h1>Explora la Luna</h1><p>Elige una escena Apollo o consulta cualquier punto y momento dentro del rango de Horizons.</p></div>
      <span className="frame-badge">ME · longitud este positiva</span>
    </div>

    <form className="custom-query" onSubmit={submitCustomScene} aria-label="Consultar condiciones para una posición y fecha">
      <div className="custom-query-heading"><div><p>Consulta personalizada</p><h2>Posición y momento</h2></div><span>UTC · Horizons</span></div>
      <div className="custom-query-fields">
        <label>Latitud lunar (°)<input type="number" min="-90" max="90" step="0.000001" required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
        <label>Longitud lunar (°)<input type="number" min="-180" max="180" step="0.000001" required value={longitude} onChange={(event) => setLongitude(event.target.value)} /><small>Este positivo; rango −180° a 180°</small></label>
        <label className="custom-time-field">Fecha y hora (UTC)<input type="datetime-local" min="1962-01-20T00:00" max={maxDateTime} step="1" required value={dateTime} onChange={(event) => setDateTime(event.target.value)} /><small>Desde 1962-01-20 hasta 75 días a futuro</small></label>
        <button type="submit" disabled={loading}>{loading ? 'Consultando…' : 'Consultar punto'}</button>
      </div>
      {error && <p className="custom-query-error" role="alert">{error}</p>}
    </form>

    <section className="mission-workbench" aria-label="Explorador de escenas lunares">
      <div className="globe-column">
        <div className="globe-stage">
          <Canvas camera={{ position: [0, 0, 3.6], fov: 35, near: 0.1, far: 20 }} dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: 'high-performance' }} fallback={<div className="globe-fallback">WebGL no está disponible. La ficha y los ángulos siguen disponibles.</div>}>
            <Suspense fallback={null}><GlobeScene site={site} scene={scene} selectedId={selectedId} onSelect={selectMission} /></Suspense>
          </Canvas>
          <div className="globe-caption"><span>Iluminación solar global</span><span>Textura NASA LRO · 2K</span></div>
          <p className="globe-instructions">Arrastra para girar. Usa la rueda, pellizca o flechas para moverte.</p>
        </div>
        <div className="mission-picker" role="group" aria-label="Escenas históricas Apollo">
          {missions.map((entry) => {
            const selected = entry.id === selectedId
            return <button type="button" key={entry.id} className={`mission-option${selected ? ' is-active' : ''}`} aria-pressed={selected} onClick={() => selectMission(entry.id)}><span>{entry.mission}</span><small>{entry.site_name}</small></button>
          })}
        </div>
      </div>

      <aside className="mission-dossier" aria-live="polite">
        <div className="dossier-title"><p>{mission?.site_name ?? 'Punto personalizado'}</p><h2>{mission?.mission ?? 'Escena consultada'}</h2></div>
        <div className="landing-time"><span>{mission ? 'Hora del alunizaje · UT' : 'Instante consultado · UTC'}</span><strong>{landing.time}</strong><time dateTime={scene.time_utc}>{landing.date}</time></div>
        <dl className="site-coordinates"><div><dt>Latitud</dt><dd>{site.latitude_deg.toFixed(5)}°</dd></div><div><dt>Longitud · este positivo</dt><dd>{site.longitude_deg.toFixed(5)}°</dd></div></dl>

        <AngleReadout title="Sol" body={scene.sun} />
        <AngleReadout title="Tierra" body={scene.earth} />
        <LandingAssessment scene={scene} />

        {alternative && <div className="time-note"><strong>Nota de fuente</strong><p>Una cronología de NASA registra {alternative.value.slice(11, 19)} UT, un segundo después de la hora NSSDCA usada aquí.</p><a href={alternative.source} target="_blank" rel="noreferrer">Ver cronología NASA</a></div>}
        {customScene && <p className="cache-note">{customScene.cached ? 'Resultado recuperado de la caché local.' : 'Consulta en tiempo real a JPL Horizons.'}</p>}

        <details className="method-details">
          <summary>Fuentes y método</summary>
          {customScene ? <>
            <p>Horizons calcula los ángulos aparentes sin refracción atmosférica desde este sitio lunar. La fecha se interpreta en UTC. La luz del globo usa la dirección solar reconstruida a partir de los ángulos locales en el marco ME.</p>
            <p>Horizons reporta {customScene.ephemeris_source ?? 'la efeméride indicada por el servicio'} y el marco {customScene.response_frame ?? 'lunar indicado en la respuesta'}. La consulta no transforma marcos. El relieve se evalúa con un recorte LOLA y se muestra en la tarjeta de cribado.</p>
          </> : <>
            <p>Azimut y elevación aparentes consultados en JPL Horizons para el sitio y la hora del catálogo. La dirección solar del globo se reconstruye desde esos ángulos locales en el marco ME de alta precisión de Horizons.</p>
            <p>Horizons reportó DE441 y el marco MEAN_ME de alta precisión. El catálogo de coordenadas y LOLA indican ME/DE421; la escena registra esta diferencia de marco y no afirma una conversión DE441→DE421. La transformación del render usa Y-up: (x, y, z) ME pasa a (x, z, −y).</p>
            <p>La luz solo representa la geometría solar global. La textura es visual: sus regiones polares usan rellenos de menor resolución y no se usa para calcular el horizonte local. La esfera no incluye relieve.</p>
          </>}
          <div className="source-links">{mission && <><a href={mission.sources.coordinates} target="_blank" rel="noreferrer">Coordenadas NSSDCA</a><a href={mission.sources.landing_time_utc} target="_blank" rel="noreferrer">Hora NSSDCA</a></>}<a href="https://ssd-api.jpl.nasa.gov/doc/horizons.html" target="_blank" rel="noreferrer">JPL Horizons</a><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">NASA CGI Moon Kit</a></div>
        </details>
      </aside>
    </section>
    <p className="apollo-footnote">Las escenas históricas incluyen un cribado puntual de pendiente y visibilidad con perfiles LOLA. Las consultas personalizadas usan el mismo cálculo en la fecha elegida.</p>
  </main>
}
