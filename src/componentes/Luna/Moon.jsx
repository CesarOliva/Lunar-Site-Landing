
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import * as THREE from 'three'

import { Canvas, useFrame, useThree } from '@react-three/fiber'

import {
  Html,
  useGLTF,
} from '@react-three/drei'

import Lighting from './Lighting'

const MOON_MODEL = '/modelos/Moon_NASA_LRO_8k_Topo_Small.glb'
const SATURN_V_MODEL = '/modelos/Saturn%20V.glb'

const MOON_RADIUS = 1.1
const INTRO_CAMERA_DISTANCE = 7.5
const HOME_CAMERA_DISTANCE = 2.8
const FOCUSED_CAMERA_DISTANCE = 2
const MIN_MISSION_ROTATION_DURATION = 1.2
const MISSION_ROTATION_RADIANS_PER_SECOND = 1.6
const ROCKET_START_Z = 4.2
const ROCKET_FLIGHT_START_Z = 5.4
const ROCKET_TRAVEL_END_X = -1.8
const ROCKET_TRAVEL_END_Z = 3.4
const ROCKET_EXIT_DURATION = 0.9
const ROCKET_FLIGHT_DURATION = 1
const ROCKET_OVERTAKE_DURATION = 0.7
const ROCKET_TRAVEL_DURATION = ROCKET_FLIGHT_DURATION + ROCKET_OVERTAKE_DURATION
const ROCKET_TRAVEL_END_SCALE = 0.28
const MARKER_BOOT_BLINK_DURATION = 1000

// Convierte latitud y longitud lunar en una posición 3D.
function getMoonPosition(latitude, longitude, radius = MOON_RADIUS) {
  const lat = THREE.MathUtils.degToRad(latitude)
  const lon = THREE.MathUtils.degToRad(longitude)

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon)
  )
}

// Modelo lunar.
function MoonModel() {
  const { scene } = useGLTF(MOON_MODEL)

  const moon = useMemo(() => {
    const clone = scene.clone(true)

    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    const maxDimension = Math.max(size.x, size.y, size.z)

    if (maxDimension > 0) {
      clone.position.sub(center)
      clone.scale.setScalar((MOON_RADIUS * 2) / maxDimension)
    }

    return clone
  }, [scene])

  return <primitive object={moon} />
}

function SaturnRocket({ phase }) {
  const { scene } = useGLTF(SATURN_V_MODEL)
  const { camera, size } = useThree()
  const motionGroup = useRef()
  const rollGroup = useRef()
  const elapsed = useRef(0)
  const flightElapsed = useRef(0)
  const cameraDistance = INTRO_CAMERA_DISTANCE - ROCKET_START_Z
  const viewHeight = 2
    * cameraDistance
    * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const viewWidth = viewHeight
    * (size.width / Math.max(size.height, 1))
  const rocketLength = Math.min(2.6, Math.max(1.2, viewWidth * 0.52))
  const flightCameraDistance = INTRO_CAMERA_DISTANCE - ROCKET_FLIGHT_START_Z
  const flightViewWidth = 2
    * flightCameraDistance
    * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    * (size.width / Math.max(size.height, 1))
  const flightStartX = flightViewWidth / 2 + rocketLength * 0.2
  const flightHeading = Math.atan2(
    flightStartX - ROCKET_TRAVEL_END_X,
    ROCKET_FLIGHT_START_Z - ROCKET_TRAVEL_END_Z
  )
  const startX = -Math.min(viewWidth * 0.2, rocketLength * 0.52)
  const exitY = -viewHeight / 2 - rocketLength
  const rocket = useMemo(() => {
    const clone = scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const dimensions = bounds.getSize(new THREE.Vector3())

    if (dimensions.y > 0) {
      const scale = rocketLength / dimensions.y
      clone.scale.setScalar(scale)
      clone.position.copy(center).multiplyScalar(-scale)
    }

    return clone
  }, [rocketLength, scene])

  useFrame((_, delta) => {
    if (!motionGroup.current || !rollGroup.current) return

    elapsed.current += delta
    rollGroup.current.rotation.y = elapsed.current * 0.07

    if (phase === 'launch') {
      flightElapsed.current = Math.min(
        flightElapsed.current + delta,
        ROCKET_EXIT_DURATION
      )
      const progress = flightElapsed.current / ROCKET_EXIT_DURATION
      const easedProgress = progress * progress * (3 - 2 * progress)

      motionGroup.current.position.set(
        startX + rocketLength * 0.2 * easedProgress,
        exitY * easedProgress,
        ROCKET_START_Z
      )
      motionGroup.current.scale.setScalar(1)
      return
    }

    if (phase === 'flight' || phase === 'overtake') {
      flightElapsed.current = Math.min(
        flightElapsed.current + delta,
        ROCKET_TRAVEL_DURATION
      )
      const progress = flightElapsed.current / ROCKET_TRAVEL_DURATION
      const easedProgress = progress * progress * (3 - 2 * progress)

      motionGroup.current.position.set(
        THREE.MathUtils.lerp(flightStartX, ROCKET_TRAVEL_END_X, easedProgress),
        THREE.MathUtils.lerp(-0.42, 0.05, easedProgress),
        THREE.MathUtils.lerp(ROCKET_FLIGHT_START_Z, ROCKET_TRAVEL_END_Z, easedProgress)
      )
      motionGroup.current.scale.setScalar(
        THREE.MathUtils.lerp(1, ROCKET_TRAVEL_END_SCALE, easedProgress)
      )
      return
    }

    flightElapsed.current = 0
    motionGroup.current.position.set(
      startX,
      Math.sin(elapsed.current * 0.65) * 0.035,
      ROCKET_START_Z + Math.sin(elapsed.current * 0.48) * 0.012
    )
    motionGroup.current.scale.setScalar(1)
  })

  return (
    <group ref={motionGroup}>
      <group
        rotation={phase === 'flight' || phase === 'overtake'
          ? [0, flightHeading, 0]
          : [0, 0, 0]}
      >
        <group
          rotation={phase === 'flight' || phase === 'overtake'
            ? [-Math.PI / 2, 0, 0]
            : [0, 0, -Math.PI * 0.75]}
        >
          <group ref={rollGroup}>
            <primitive object={rocket} />
          </group>
        </group>
      </group>
    </group>
  )
}

// Marcador individual de misión.
function MissionMarker({
  mission,
  onSelect,
  selected,
  highlighted,
  moonGroup,
  bootBlinking,
  ambientBlinking,
  index,
}) {
  const position = useMemo(
    () => getMoonPosition(
      mission.latitude,
      mission.longitude,
      MOON_RADIUS * 1.018
    ),
    [mission.latitude, mission.longitude]
  )

  const { camera } = useThree()
  const label = useRef()
  const markerMesh = useRef()
  const glowMesh = useRef()
  const markerMaterial = useRef()
  const glowMaterial = useRef()
  const bootElapsed = useRef(0)
  const ambientElapsed = useRef(0)
  const [pointerHovered, setPointerHovered] = useState(false)
  const hovered = pointerHovered || highlighted
  const cameraLocalPosition = useMemo(() => new THREE.Vector3(), [])
  const surfaceNormal = useMemo(
    () => position.clone().normalize(),
    [position]
  )

  useFrame((_, delta) => {
    let lightLevel = 1

    if (!selected && !hovered && bootBlinking) {
      bootElapsed.current += delta
      const rapidPulse = Math.sin(
        bootElapsed.current * (34 + index * 2.5) + index * 4.1
      )
      const slowPulse = Math.sin(bootElapsed.current * 13.7 + index * 2.3)
      lightLevel = rapidPulse + slowPulse * 0.25 > 0.35 ? 1 : 0.08
    } else if (!selected && !hovered && ambientBlinking) {
      ambientElapsed.current += delta
      const pulse = Math.sin(
        ambientElapsed.current * 34 + index * 3.7
      )
      lightLevel = pulse > 0.1 ? 1 : 0.08
    } else {
      ambientElapsed.current = 0
    }

    if (markerMesh.current) {
      const scale = THREE.MathUtils.damp(
        markerMesh.current.scale.x,
        (hovered ? 1.35 : 1) * (0.55 + lightLevel * 0.45),
        12,
        delta
      )
      markerMesh.current.scale.setScalar(scale)
    }

    if (markerMaterial.current) {
      markerMaterial.current.opacity = selected || hovered ? 1 : lightLevel
    }

    if (glowMesh.current) {
      const scale = THREE.MathUtils.damp(
        glowMesh.current.scale.x,
        (hovered ? 2.3 : 1.8) * (0.55 + lightLevel * 0.45),
        12,
        delta
      )
      glowMesh.current.scale.setScalar(scale)
    }

    if (glowMaterial.current) {
      glowMaterial.current.opacity = (hovered ? 0.28 : 0.15) * lightLevel
    }

    if (!label.current || !moonGroup.current) return

    cameraLocalPosition.copy(camera.position)
    moonGroup.current.worldToLocal(cameraLocalPosition)

    const visibility = surfaceNormal.dot(cameraLocalPosition.normalize()) > 0.05
      ? 'visible'
      : 'hidden'

    if (label.current.style.visibility !== visibility) {
      label.current.style.visibility = visibility
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={markerMesh}
      >
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial
          ref={markerMaterial}
          color={selected || hovered ? '#FFFFFF' : '#39FF88'}
          transparent
          depthTest={true}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={glowMesh}
        scale={1.8}
        onPointerOver={(event) => {
          event.stopPropagation()
          setPointerHovered(true)
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          setPointerHovered(false)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(mission)
        }}
      >
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial
          ref={glowMaterial}
          color={hovered ? '#FFFFFF' : '#39FF88'}
          transparent
          opacity={hovered ? 0.28 : 0.15}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[0.045, 0.035, 0]}
        distanceFactor={2}
        style={{
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          ref={label}
          className={`moon-marker-label ${selected ? 'active' : ''} ${hovered ? 'hovered' : ''}`}
        >
          {mission.number} / {mission.name}
        </div>
      </Html>
    </group>
  )
}

// Escena completa de la Luna.
function MoonScene({
  missions,
  selectedMission,
  hoveredMission,
  phase,
  onShowMission,
  moonGroup,
  dragging,
}) {
  const { camera, size } = useThree()
  const [bootBlinking, setBootBlinking] = useState(false)
  const [ambientBlinkingMissions, setAmbientBlinkingMissions] = useState(
    () => new Set()
  )
  const moonScale = useMemo(() => {
    if (size.width <= 560) return 0.55
    if (size.width <= 800) return 0.68
    if (size.width <= 1050) return 0.75
    return 0.82
  }, [size.width])

  const initialCameraDistance = phase === 'intro'
    ? INTRO_CAMERA_DISTANCE
    : HOME_CAMERA_DISTANCE
  const cameraTarget = useRef(
    new THREE.Vector3(0, 0, initialCameraDistance)
  )
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0))

  const focused = useRef(false)
  const cameraAnimating = useRef(false)
  const missionRotationTarget = useRef(new THREE.Quaternion())
  const missionRotationStart = useRef(new THREE.Quaternion())
  const missionRotationElapsed = useRef(0)
  const missionRotationDuration = useRef(MIN_MISSION_ROTATION_DURATION)
  const missionRotationAnimating = useRef(false)

  useEffect(() => {
    if (phase !== 'home' || missions.length === 0) {
      setBootBlinking(false)
      return undefined
    }

    setBootBlinking(true)
    const timer = window.setTimeout(
      () => setBootBlinking(false),
      MARKER_BOOT_BLINK_DURATION
    )

    return () => window.clearTimeout(timer)
  }, [missions, phase])

  useEffect(() => {
    setAmbientBlinkingMissions(new Set())
    if (phase !== 'home' || missions.length === 0) return undefined

    let nextBlinkTimer
    let finishBlinkTimer
    const scheduleBlink = () => {
      nextBlinkTimer = window.setTimeout(() => {
        const candidates = missions.filter(
          (mission) => mission.id !== selectedMission?.id
        )
        const count = Math.min(
          candidates.length,
          Math.random() < 0.3 ? 2 : 1
        )

        for (let index = candidates.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1))
          const candidate = candidates[index]
          candidates[index] = candidates[swapIndex]
          candidates[swapIndex] = candidate
        }

        setAmbientBlinkingMissions(
          new Set(candidates.slice(0, count).map((mission) => mission.id))
        )
        finishBlinkTimer = window.setTimeout(() => {
          setAmbientBlinkingMissions(new Set())
          scheduleBlink()
        }, 500)
      }, 2800 + Math.random() * 4000)
    }

    scheduleBlink()
    return () => {
      window.clearTimeout(nextBlinkTimer)
      window.clearTimeout(finishBlinkTimer)
    }
  }, [missions, phase, selectedMission?.id])

  // Prepara un acercamiento cinematográfico.
  const focusMission = useCallback((mission) => {
    if (!moonGroup.current || !mission) return

    const missionDirection = getMoonPosition(
      mission.latitude,
      mission.longitude
    ).normalize()
    missionRotationTarget.current.setFromUnitVectors(
      missionDirection,
      new THREE.Vector3(0, 0, 1)
    )
    missionRotationStart.current.copy(moonGroup.current.quaternion)
    missionRotationElapsed.current = 0
    const rotationAngle = missionRotationStart.current.angleTo(
      missionRotationTarget.current
    )
    missionRotationDuration.current = Math.max(
      MIN_MISSION_ROTATION_DURATION,
      rotationAngle / MISSION_ROTATION_RADIANS_PER_SECOND
    )
    missionRotationAnimating.current = rotationAngle > 0.001

    const center = moonGroup.current.getWorldPosition(new THREE.Vector3())
    const zoomRatio = FOCUSED_CAMERA_DISTANCE / HOME_CAMERA_DISTANCE

    lookTarget.current.set(
      center.x * (1 - zoomRatio),
      center.y * (1 - zoomRatio),
      center.z * (1 - zoomRatio)
    )
    cameraTarget.current.set(
      lookTarget.current.x,
      lookTarget.current.y,
      lookTarget.current.z + FOCUSED_CAMERA_DISTANCE
    )

    focused.current = true
    cameraAnimating.current = true
  }, [])

  // Permite enfocar misiones seleccionadas desde otros componentes.
  useEffect(() => {
    if (selectedMission) {
      focusMission(selectedMission)
      return
    }

    focused.current = false
    missionRotationAnimating.current = false
    lookTarget.current.set(0, 0, 0)

    if (['intro', 'launch', 'launch-pause', 'flight'].includes(phase)) {
      cameraTarget.current.set(0, 0, INTRO_CAMERA_DISTANCE)
      cameraAnimating.current = false
      return
    }

    cameraTarget.current.set(0, 0, HOME_CAMERA_DISTANCE)
    cameraAnimating.current = true
  }, [selectedMission, phase, focusMission])

  // Movimiento continuo y suave de la Luna y la cámara.
  useFrame((_, delta) => {
    if (!moonGroup.current) return

    const group = moonGroup.current

    if (dragging.current && focused.current) {
      focused.current = false
      cameraAnimating.current = false
      missionRotationAnimating.current = false
    }

    if (missionRotationAnimating.current && !dragging.current) {
      missionRotationElapsed.current += delta
      const progress = Math.min(
        missionRotationElapsed.current / missionRotationDuration.current,
        1
      )
      const easedProgress = progress * progress * (3 - 2 * progress)

      group.quaternion.slerpQuaternions(
        missionRotationStart.current,
        missionRotationTarget.current,
        easedProgress
      )

      if (progress === 1) {
        group.quaternion.copy(missionRotationTarget.current)
        missionRotationAnimating.current = false
      }
    }

    if (!focused.current && !dragging.current) {
      group.rotation.y += delta * 0.035
    }

    if (cameraAnimating.current && !dragging.current) {
      const smooth = 1 - Math.exp(-3.2 * delta)
      camera.position.lerp(cameraTarget.current, smooth)
      camera.lookAt(lookTarget.current)

      if (camera.position.distanceToSquared(cameraTarget.current) < 0.0001) {
        camera.position.copy(cameraTarget.current)
        camera.lookAt(lookTarget.current)
        cameraAnimating.current = false
      }
    }
  })

  return (
    <>
      <Lighting />

      {['intro', 'launch', 'flight', 'overtake'].includes(phase) && (
        <Suspense fallback={null}>
          <SaturnRocket phase={phase} />
        </Suspense>
      )}

      <group
        ref={moonGroup}
        scale={moonScale}
      >
        <MoonModel />

        {missions.map((mission, index) => (
          <MissionMarker
            key={mission.id}
            mission={mission}
            selected={selectedMission?.id === mission.id}
            highlighted={hoveredMission?.id === mission.id}
            onSelect={onShowMission}
            moonGroup={moonGroup}
            bootBlinking={bootBlinking}
            ambientBlinking={ambientBlinkingMissions.has(mission.id)}
            index={index}
          />
        ))}
      </group>

    </>
  )
}

// Componente público.
export default function Moon({
  missions = [],
  selectedMission = null,
  hoveredMission = null,
  onShowMission,
  phase = 'home',
}) {
  const moonGroup = useRef()
  const container = useRef()
  const dragging = useRef(false)
  const dragPointer = useRef(null)
  const previousPointer = useRef({ x: 0, y: 0 })

  const handlePointerDown = useCallback((event) => {
    if (event.button !== 0) return

    dragPointer.current = event.pointerId
    previousPointer.current = { x: event.clientX, y: event.clientY }
    dragging.current = true
    container.current.style.cursor = 'grabbing'
    event.preventDefault()
  }, [])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (dragPointer.current !== event.pointerId || !moonGroup.current) return

      const deltaX = event.clientX - previousPointer.current.x
      const deltaY = event.clientY - previousPointer.current.y
      previousPointer.current = { x: event.clientX, y: event.clientY }

      moonGroup.current.rotation.y += deltaX * 0.005
      moonGroup.current.rotation.x = THREE.MathUtils.clamp(
        moonGroup.current.rotation.x + deltaY * 0.005,
        -Math.PI / 2,
        Math.PI / 2
      )
    }

    const stopDragging = (event) => {
      if (dragPointer.current !== event.pointerId) return

      dragPointer.current = null
      dragging.current = false
      container.current.style.cursor = 'grab'
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [])

  return (
    <div
      ref={container}
      className="moon-3d-container"
      onPointerDown={handlePointerDown}
    >
      <Canvas
        camera={{
          position: [
            0,
            0,
            phase === 'intro' || phase === 'launch'
              ? INTRO_CAMERA_DISTANCE
              : HOME_CAMERA_DISTANCE,
          ],
          fov: 38,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={1}
      >
        <Suspense fallback={null}>
          <MoonScene
            missions={missions}
            selectedMission={selectedMission}
            hoveredMission={hoveredMission}
            phase={phase}
            onShowMission={onShowMission}
            moonGroup={moonGroup}
            dragging={dragging}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(MOON_MODEL)
useGLTF.preload(SATURN_V_MODEL)
