import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
// Ajusta esta ruta a tu modelo. Puedes asignar un modelo distinto a cada tipo de misión.
const shipModelUrl = '/modelos/nave.glb'
const lunarModelUrl = '/modelos/Moon_NASA_LRO_8k_Topo_Small.glb'

const shipModels = {
  robotic: shipModelUrl,
  'crewed-short': shipModelUrl,
  'crewed-long': shipModelUrl,
  'sample-return': shipModelUrl,
}
// Si la punta de tu modelo mira hacia +Y (cohete "de pie"), deja esto. Si mira hacia +Z, usa new THREE.Euler(0, 0, 0).
const MODEL_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0)
const MODEL_SIZE = 0.7

const EARTH = new THREE.Vector3(-6, 0, 0)
const MOON = new THREE.Vector3(6, 0, 0)
const EARTH_RADIUS = 1.8
const MOON_RADIUS = 1.2
const TRAIL_POINTS = 300

const transitProfiles = {
  'Química': { turns: 0, seconds: 6, note: 'Un impulso corto y potente lleva la nave directo a la Luna.' },
  'Eléctrica': { turns: 4, seconds: 12, note: 'Empuje suave y continuo: la nave espira alrededor de la Tierra antes de partir.' },
  'Híbrida': { turns: 2, seconds: 9, note: 'Un primer impulso fuerte y una fase de empuje suave reducen el combustible.' },
}

const ease = (value) => value * value * (3 - 2 * value)
const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

function buildRoute(propulsion, latitude, longitude) {
  const lat = THREE.MathUtils.degToRad(latitude)
  const lon = THREE.MathUtils.degToRad(longitude)
  const normal = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
  const surface = MOON.clone().addScaledVector(normal, MOON_RADIUS + 0.06)
  const approach = MOON.clone().addScaledVector(normal, MOON_RADIUS + 1.6)
  const leo = EARTH.clone().add(new THREE.Vector3(2.6, 0, 0))
  const launch = new THREE.QuadraticBezierCurve3(
    EARTH.clone().add(new THREE.Vector3(EARTH_RADIUS, 0, 0)),
    EARTH.clone().add(new THREE.Vector3(2.4, 1.2, 0)),
    leo,
  )
  const profile = transitProfiles[propulsion] ?? transitProfiles['Química']
  const points = [leo]
  if (profile.turns > 0) {
    points.length = 0
    const steps = profile.turns * 48
    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps
      const angle = progress * profile.turns * 2 * Math.PI
      const radius = 2.6 + progress * 0.8
      points.push(new THREE.Vector3(EARTH.x + radius * Math.cos(angle), EARTH.y + radius * Math.sin(angle), 0))
    }
  }
  const last = points[points.length - 1]
  const exit = new THREE.QuadraticBezierCurve3(last, new THREE.Vector3((last.x + approach.x) / 2, 3, 0), approach).getPoints(40)
  const transit = new THREE.CatmullRomCurve3([...points, ...exit.slice(1)], false, 'centripetal')
  return { normal, surface, approach, launch, transit }
}

function buildPhases(propulsion, hasSample) {
  const profile = transitProfiles[propulsion] ?? transitProfiles['Química']
  const list = [
    { id: 'launch', label: 'Lanzamiento', seconds: 3 },
    { id: 'transit', label: 'Tránsito translunar', seconds: profile.seconds },
    { id: 'descent', label: 'Descenso', seconds: 4 },
    { id: 'ops', label: 'Operaciones', seconds: 4 },
    ...(hasSample ? [{ id: 'return', label: 'Retorno de muestras', seconds: 7 }] : []),
  ]
  let time = 0
  return list.map((phase) => {
    const item = { ...phase, start: time, end: time + phase.seconds }
    time += phase.seconds
    return item
  })
}

function poseAt(route, phase, u) {
  const e = ease(u)
  if (phase.id === 'launch') return { position: route.launch.getPointAt(e), direction: route.launch.getTangentAt(e), trail: 0 }
  if (phase.id === 'transit') return { position: route.transit.getPointAt(e), direction: route.transit.getTangentAt(e), trail: e }
  if (phase.id === 'descent') {
    const k = 1 - (1 - u) * (1 - u)
    return { position: route.approach.clone().lerp(route.surface, k), direction: route.normal, trail: 1 }
  }
  if (phase.id === 'return') {
    if (u < 0.25) return { position: route.surface.clone().lerp(route.approach, ease(u / 0.25)), direction: route.normal, trail: 1 }
    const v = ease((u - 0.25) / 0.75)
    return { position: route.transit.getPointAt(1 - v), direction: route.transit.getTangentAt(1 - v).negate(), trail: 1 - v }
  }
  return { position: route.surface.clone(), direction: route.normal, trail: 1 }
}

function captionFor(id, form, latitude, longitude, day) {
  const profile = transitProfiles[form.propulsion] ?? transitProfiles['Química']
  if (id === 'launch') return `${form.vehicle || 'El lanzador'} despega desde ${form.launchSite}. Ventana de referencia: ${form.launchWindow}.`
  if (id === 'transit') return `Propulsión ${form.propulsion.toLowerCase()}. ${profile.note}`
  if (id === 'descent') return `Descenso hacia ${latitude.toFixed(4)}°, ${longitude.toFixed(2)}° E, con un área de aterrizaje de ${form.landingArea.replace('Radio de ', 'radio ')} y pendiente máxima de ${form.maxSlope}.`
  if (id === 'ops') return `${form.objective}. Día ${day} de ${form.durationDays} (${form.payload.toLowerCase()}).`
  return `${form.sampleReturn} lleva ${form.sampleTarget.toLowerCase()} de vuelta a la Tierra.`
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => material?.dispose())
  })
}

export default function PlanningSimulation({ form, missionProfile, onClose }) {
  const mountRef = useRef(null)
  const clock = useRef({ time: 0, playing: true })
  const hasSample = missionProfile.conditionalSteps.includes('sample')
  const latitude = Number.isFinite(Number(form.latitude)) ? Number(form.latitude) : -89.7668
  const longitude = Number.isFinite(Number(form.longitude)) ? Number(form.longitude) : 188.13
  const phases = useMemo(() => buildPhases(form.propulsion, hasSample), [form.propulsion, hasSample])
  const total = phases[phases.length - 1].end
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const modelUrl = shipModels[missionProfile.id] ?? shipModelUrl

  useEffect(() => {
    const mount = mountRef.current
    clock.current = { time: 0, playing: true }
    let disposed = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    camera.position.set(0, 3, 20)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x030605, 1)
    mount.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, -0.6, 0)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 8
    controls.maxDistance = 35

    scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(-10, 8, 10)
    scene.add(sun)

    const starPositions = []
    for (let index = 0; index < 400; index += 1) {
      const point = new THREE.Vector3().randomDirection().multiplyScalar(60)
      starPositions.push(point.x, point.y, point.z)
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xf4fbf6, size: 0.12 })))

    const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 32, 24), new THREE.MeshStandardMaterial({ color: 0x0b2a1a, roughness: 1 }))
    earth.position.copy(EARTH)
    scene.add(earth)
    const earthGrid = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 18, 12)),
      new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.35 }),
    )
    earthGrid.position.copy(EARTH)
    scene.add(earthGrid)
    const moonFallback = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, 40, 28), new THREE.MeshStandardMaterial({ color: 0xc9dccf, roughness: 1 }))
    moonFallback.position.copy(MOON)
    scene.add(moonFallback)
    new GLTFLoader().load(lunarModelUrl, (gltf) => {
      if (disposed) return
      const moonModel = gltf.scene
      const bounds = new THREE.Box3().setFromObject(moonModel)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const diameter = Math.max(size.x, size.y, size.z)
      const moon = new THREE.Group()
      moonModel.position.sub(center)
      if (diameter > 0) moonModel.scale.setScalar((MOON_RADIUS * 2) / diameter)
      moon.position.copy(MOON)
      moon.add(moonModel)
      scene.remove(moonFallback)
      moonFallback.geometry.dispose()
      moonFallback.material.dispose()
      scene.add(moon)
    }, undefined, () => {})

    const route = buildRoute(form.propulsion, latitude, longitude)
    const pathPoints = route.transit.getPoints(TRAIL_POINTS)
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints)
    scene.add(new THREE.Line(pathGeometry, new THREE.LineDashedMaterial({ color: 0xf4fbf6, transparent: true, opacity: 0.25, dashSize: 0.2, gapSize: 0.15 })).computeLineDistances())
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints)
    trailGeometry.setDrawRange(0, 0)
    scene.add(new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0x00ff66 })))

    const marker = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.14, 32), new THREE.MeshBasicMaterial({ color: 0xf4fbf6, side: THREE.DoubleSide, transparent: true }))
    marker.position.copy(route.surface)
    marker.lookAt(route.surface.clone().add(route.normal))
    scene.add(marker)

    const ship = new THREE.Group()
    const holder = new THREE.Group()
    ship.add(holder)
    scene.add(ship)
    const fallback = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xf4fbf6 }))
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x00ff66 }))
    body.rotation.x = Math.PI / 2
    nose.rotation.x = Math.PI / 2
    nose.position.z = 0.36
    fallback.add(body, nose)
    holder.add(fallback)
    new GLTFLoader().load(modelUrl, (gltf) => {
      if (disposed) return
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      model.position.sub(box.getCenter(new THREE.Vector3()))
      const wrap = new THREE.Group()
      wrap.add(model)
      wrap.scale.setScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z))
      wrap.rotation.copy(MODEL_ROTATION)
      holder.clear()
      holder.add(wrap)
    }, undefined, () => {})

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let frame
    let last = performance.now()
    const tick = (now) => {
      const state = clock.current
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      if (state.playing) {
        state.time = Math.min(state.time + delta, total)
        if (state.time >= total) {
          state.playing = false
          setPlaying(false)
        }
      }
      let index = phases.findIndex((phase) => state.time <= phase.end)
      if (index === -1) index = phases.length - 1
      const phase = phases[index]
      const u = clamp01((state.time - phase.start) / (phase.end - phase.start))
      const pose = poseAt(route, phase, u)
      ship.position.copy(pose.position)
      ship.lookAt(pose.position.clone().add(pose.direction))
      trailGeometry.setDrawRange(0, Math.ceil(pose.trail * (TRAIL_POINTS + 1)))
      marker.material.opacity = 0.55 + 0.45 * Math.sin(now / 250)
      setPhaseIndex(index)
      setProgress(Math.round((state.time / total) * 200) / 2)
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      disposeScene(scene)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [form.propulsion, latitude, longitude, modelUrl, phases, total])

  const finished = progress >= 100
  const phase = phases[phaseIndex]
  const days = Math.max(Number(form.durationDays) || 1, 1)
  const opsU = clamp01((progress / 100 * total - phase.start) / (phase.end - phase.start))
  const day = Math.min(Math.max(Math.ceil(opsU * days), 1), days)

  const toggle = () => {
    const state = clock.current
    if (state.time >= total) state.time = 0
    state.playing = !state.playing || state.time === 0
    setPlaying(state.playing)
  }
  const jump = (index) => {
    clock.current.time = phases[index].start
    clock.current.playing = true
    setPlaying(true)
  }

  return (
    <div className="sim-card" role="region" aria-label="Simulación de la misión">
      <div className="sim-header">
        <strong>Simulación: {form.name || 'misión sin nombre'}</strong>
        <button className="sim-close" type="button" onClick={onClose}><X size={16} /> Cerrar</button>
      </div>
      <div className="sim-stage" ref={mountRef} />
      <div className="sim-bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
      <div className="sim-controls">
        <button className="planning-choice is-selected sim-play" type="button" onClick={toggle}>
          {playing ? <Pause size={14} /> : finished ? <RotateCcw size={14} /> : <Play size={14} />}
          {playing ? 'Pausar' : finished ? 'Repetir' : 'Continuar'}
        </button>
        <ol className="sim-phases">
          {phases.map((item, index) => (
            <li key={item.id}>
              <button className={`sim-phase ${index === phaseIndex ? 'is-current' : ''} ${index < phaseIndex ? 'is-done' : ''}`} type="button" onClick={() => jump(index)}>
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sim-caption" aria-live="polite">
        <strong>{phase.label}</strong>
        <p>{captionFor(phase.id, form, latitude, longitude, day)}</p>
      </div>
      <p className="planning-note">Simulación ilustrativa: distancias, tiempos y trayectoria no están a escala ni son un cálculo orbital. Arrastra para girar la vista.</p>
    </div>
  )
}