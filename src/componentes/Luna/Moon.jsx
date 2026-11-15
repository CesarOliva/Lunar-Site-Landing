
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

const MOON_RADIUS = 1.1
const INTRO_CAMERA_DISTANCE = 7.5
const HOME_CAMERA_DISTANCE = 2.8
const FOCUSED_CAMERA_DISTANCE = 2
const MIN_MISSION_ROTATION_DURATION = 1.2
const MISSION_ROTATION_RADIANS_PER_SECOND = 1.6

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

// Marcador individual de misión.
function MissionMarker({
  mission,
  onSelect,
  selected,
  highlighted,
  moonGroup,
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
  const [pointerHovered, setPointerHovered] = useState(false)
  const hovered = pointerHovered || highlighted
  const cameraLocalPosition = useMemo(() => new THREE.Vector3(), [])
  const surfaceNormal = useMemo(
    () => position.clone().normalize(),
    [position]
  )

  useFrame((_, delta) => {
    if (markerMesh.current) {
      const scale = THREE.MathUtils.damp(
        markerMesh.current.scale.x,
        hovered ? 1.35 : 1,
        12,
        delta
      )
      markerMesh.current.scale.setScalar(scale)
    }

    if (glowMesh.current) {
      const scale = THREE.MathUtils.damp(
        glowMesh.current.scale.x,
        hovered ? 2.3 : 1.8,
        12,
        delta
      )
      glowMesh.current.scale.setScalar(scale)
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
          color={selected || hovered ? '#FFFFFF' : '#39FF88'}
          depthTest={true}
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

    if (phase === 'intro') {
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

      <group
        ref={moonGroup}
        scale={moonScale}
      >
        <MoonModel />

        {missions.map((mission) => (
          <MissionMarker
            key={mission.id}
            mission={mission}
            selected={selectedMission?.id === mission.id}
            highlighted={hoveredMission?.id === mission.id}
            onSelect={onShowMission}
            moonGroup={moonGroup}
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
            phase === 'intro' ? INTRO_CAMERA_DISTANCE : HOME_CAMERA_DISTANCE,
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
