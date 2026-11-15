
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

import Lighting, { SunLight } from './Lighting'
import HighQualityMoon from '../../../moon/src/integracion/HighQualityMoon.jsx'

const SATURN_V_MODEL = '/modelos/Saturn%20V.glb'

const MOON_RADIUS = 1.1
const INTRO_CAMERA_DISTANCE = 7.5
const HOME_CAMERA_DISTANCE = 2.8
const FOCUSED_CAMERA_DISTANCE = 2
const MIN_MISSION_ROTATION_DURATION = 1.2
const MISSION_ROTATION_RADIANS_PER_SECOND = 1.6
const ROCKET_START_Z = 4.2
const ROCKET_START_X_OFFSET = 0
const ROCKET_START_FORWARD_OFFSET = 0.28
const ROCKET_INTRO_POSE_DURATION = 1.1
const ROCKET_LAUNCH_DURATION = 2.6
const ROCKET_LAUNCH_PREPARE_DURATION = 0.35
const ROCKET_SIDE_Z_ROTATION = -Math.PI / 2
const ROCKET_READY_X_ROTATION = THREE.MathUtils.degToRad(-30)
const ROCKET_READY_Y_ROTATION = THREE.MathUtils.degToRad(180)
const ROCKET_READY_Z_ROTATION = THREE.MathUtils.degToRad(-120)
const ROCKET_READY_SCALE = 1.3
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

function SaturnRocket({ phase, onLaunchComplete }) {
  const { scene } = useGLTF(SATURN_V_MODEL)
  const { camera, size } = useThree()
  const motionGroup = useRef()
  const poseGroup = useRef()
  const elapsed = useRef(0)
  const introElapsed = useRef(0)
  const launchElapsed = useRef(0)
  const launchCompleteSent = useRef(false)
  const previousPhase = useRef(null)
  const launchOrigin = useRef(new THREE.Vector3())
  const launchStartRotation = useRef(new THREE.Euler(0, 0, ROCKET_SIDE_Z_ROTATION))
  const launchStartScale = useRef(1)
  const forwardDirection = useRef(new THREE.Vector3())
  const cameraDistance = INTRO_CAMERA_DISTANCE - ROCKET_START_Z
  const viewHeight = 2
    * cameraDistance
    * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const viewWidth = viewHeight
    * (size.width / Math.max(size.height, 1))
  const rocketLength = Math.min(2.6, Math.max(1.2, viewWidth * 0.52))
  const startX = -Math.min(viewWidth * 0.2, rocketLength * 0.52)
    + ROCKET_START_X_OFFSET
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
    if (!motionGroup.current || !poseGroup.current) return

    elapsed.current += delta
    if (previousPhase.current === null) {
      poseGroup.current.rotation.order = 'ZYX'
      poseGroup.current.rotation.set(0, 0, ROCKET_SIDE_Z_ROTATION)
      motionGroup.current.position.set(startX, 0, ROCKET_START_Z)
      motionGroup.current.scale.setScalar(1)
    }
    if (phase !== previousPhase.current) {
      if (phase === 'launch') {
        launchElapsed.current = 0
        launchCompleteSent.current = false
        launchOrigin.current.copy(motionGroup.current.position)
        launchStartRotation.current.copy(poseGroup.current.rotation)
        launchStartScale.current = motionGroup.current.scale.x
      }
      previousPhase.current = phase
    }

    if (phase === 'intro') {
      poseGroup.current.rotation.order = 'ZYX'
      introElapsed.current = Math.min(
        introElapsed.current + delta,
        ROCKET_INTRO_POSE_DURATION
      )
      const progress = introElapsed.current / ROCKET_INTRO_POSE_DURATION
      const easedProgress = progress * progress * (3 - 2 * progress)

      poseGroup.current.rotation.set(
        ROCKET_READY_X_ROTATION * easedProgress,
        ROCKET_READY_Y_ROTATION * easedProgress,
        THREE.MathUtils.lerp(ROCKET_SIDE_Z_ROTATION, ROCKET_READY_Z_ROTATION, easedProgress)
      )
      motionGroup.current.position.set(
        startX,
        Math.sin(elapsed.current * 0.65) * 0.035,
        ROCKET_START_Z + Math.sin(elapsed.current * 0.48) * 0.012
      )
      forwardDirection.current
        .set(0, 1, 0)
        .applyEuler(poseGroup.current.rotation)
        .normalize()
      motionGroup.current.position.addScaledVector(
        forwardDirection.current,
        ROCKET_START_FORWARD_OFFSET
      )
      motionGroup.current.scale.setScalar(
        THREE.MathUtils.lerp(1, ROCKET_READY_SCALE, easedProgress)
      )
      return
    }

    if (phase === 'launch') {
      poseGroup.current.rotation.order = 'ZYX'
      launchElapsed.current = Math.min(launchElapsed.current + delta, ROCKET_LAUNCH_DURATION)
      const prepareProgress = THREE.MathUtils.clamp(
        launchElapsed.current / ROCKET_LAUNCH_PREPARE_DURATION,
        0,
        1,
      )
      const easedPrepareProgress = prepareProgress * prepareProgress * (3 - 2 * prepareProgress)

      poseGroup.current.rotation.set(
        THREE.MathUtils.lerp(
          launchStartRotation.current.x,
          ROCKET_READY_X_ROTATION,
          easedPrepareProgress,
        ),
        THREE.MathUtils.lerp(
          launchStartRotation.current.y,
          ROCKET_READY_Y_ROTATION,
          easedPrepareProgress,
        ),
        THREE.MathUtils.lerp(
          launchStartRotation.current.z,
          ROCKET_READY_Z_ROTATION,
          easedPrepareProgress,
        ),
      )
      motionGroup.current.scale.setScalar(
        THREE.MathUtils.lerp(launchStartScale.current, ROCKET_READY_SCALE, easedPrepareProgress)
      )

      if (prepareProgress < 1) {
        motionGroup.current.position.copy(launchOrigin.current)
        return
      }

      // La punta del Saturn V apunta a +Y en su espacio local.
      forwardDirection.current
        .set(0, 1, 0)
        .applyEuler(poseGroup.current.rotation)
        .normalize()
      const rocketExtent = rocketLength * ROCKET_READY_SCALE * 0.75
      const horizontalExitDistance = forwardDirection.current.x > 0
        ? (viewWidth / 2 + rocketExtent - launchOrigin.current.x) / forwardDirection.current.x
        : forwardDirection.current.x < 0
          ? (-viewWidth / 2 - rocketExtent - launchOrigin.current.x) / forwardDirection.current.x
          : 0
      const verticalExitDistance = forwardDirection.current.y > 0
        ? (viewHeight / 2 + rocketExtent - launchOrigin.current.y) / forwardDirection.current.y
        : forwardDirection.current.y < 0
          ? (-viewHeight / 2 - rocketExtent - launchOrigin.current.y) / forwardDirection.current.y
          : 0
      const launchDistance = Math.max(horizontalExitDistance, verticalExitDistance)
      const travelProgress = THREE.MathUtils.clamp(
        (launchElapsed.current - ROCKET_LAUNCH_PREPARE_DURATION)
          / (ROCKET_LAUNCH_DURATION - ROCKET_LAUNCH_PREPARE_DURATION),
        0,
        1,
      )
      motionGroup.current.position
        .copy(launchOrigin.current)
        .addScaledVector(forwardDirection.current, launchDistance * travelProgress ** 2)
      if (travelProgress >= 1 && !launchCompleteSent.current) {
        launchCompleteSent.current = true
        onLaunchComplete?.()
      }
      return
    }

    motionGroup.current.position.set(startX, 0, ROCKET_START_Z)
    poseGroup.current.rotation.order = 'ZYX'
    poseGroup.current.rotation.set(
      ROCKET_READY_X_ROTATION,
      ROCKET_READY_Y_ROTATION,
      ROCKET_READY_Z_ROTATION,
    )
    forwardDirection.current
      .set(0, 1, 0)
      .applyEuler(poseGroup.current.rotation)
      .normalize()
    motionGroup.current.position.addScaledVector(
      forwardDirection.current,
      ROCKET_START_FORWARD_OFFSET
    )
    motionGroup.current.scale.setScalar(ROCKET_READY_SCALE)
  })

  return (
    <group ref={motionGroup}>
      <group ref={poseGroup}>
        <primitive object={rocket} />
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

function CustomMarker({ latitude, longitude }) {
  const position = useMemo(
    () => getMoonPosition(latitude, longitude, MOON_RADIUS * 1.022),
    [latitude, longitude]
  )

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color="#39FF88" />
      </mesh>
      <mesh scale={2.1}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color="#39FF88" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

// Escena completa de la Luna.
function MoonScene({
  missions,
  selectedMission,
  hoveredMission,
  scene,
  phase,
  onShowMission,
  onLaunchComplete,
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

  const initialCameraDistance = ['intro', 'launch'].includes(phase)
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
  const focusMission = useCallback((location) => {
    if (!moonGroup.current || !location) return

    const missionDirection = getMoonPosition(
      location.latitude_deg ?? location.latitude,
      location.longitude_deg ?? location.longitude
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
    const location = scene?.site ?? selectedMission
    if (location) {
      focusMission(location)
      return
    }

    focused.current = false
    missionRotationAnimating.current = false
    lookTarget.current.set(0, 0, 0)

    if (['intro', 'launch'].includes(phase)) {
      cameraTarget.current.set(0, 0, INTRO_CAMERA_DISTANCE)
      cameraAnimating.current = false
      return
    }

    cameraTarget.current.set(0, 0, HOME_CAMERA_DISTANCE)
    cameraAnimating.current = true
  }, [selectedMission, scene?.site?.latitude_deg, scene?.site?.longitude_deg, phase, focusMission])

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
      <Lighting scene={scene} />

      {['intro', 'launch'].includes(phase) && (
        <Suspense fallback={null}>
          <SaturnRocket phase={phase} onLaunchComplete={onLaunchComplete} />
        </Suspense>
      )}

      <group
        ref={moonGroup}
        scale={moonScale}
      >
        {scene?.sun?.direction_me && <SunLight scene={scene} />}
        {/* Luna de 256 teselas de NASA Trek: aparece con un fundido cuando termina de descargarse. */}
        <HighQualityMoon radius={MOON_RADIUS} />

        {scene?.site && selectedMission && (
          Math.abs(scene.site.latitude_deg - selectedMission.latitude) > 0.000001
          || Math.abs(scene.site.longitude_deg - selectedMission.longitude) > 0.000001
        ) && <CustomMarker latitude={scene.site.latitude_deg} longitude={scene.site.longitude_deg} />}

        {missions.map((mission, index) => (
          <MissionMarker
            key={mission.id}
            mission={mission}
            selected={selectedMission?.id === mission.id && (
              !scene?.site
              || (Math.abs(scene.site.latitude_deg - mission.latitude) <= 0.000001
                && Math.abs(scene.site.longitude_deg - mission.longitude) <= 0.000001)
            )}
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
  scene = null,
  onShowMission,
  onLaunchComplete,
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
            ['intro', 'launch'].includes(phase)
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
            scene={scene}
            phase={phase}
            onShowMission={onShowMission}
            onLaunchComplete={onLaunchComplete}
            moonGroup={moonGroup}
            dragging={dragging}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(SATURN_V_MODEL)
