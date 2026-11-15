
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
function MissionMarker({ mission, onSelect, selected, moonGroup }) {
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
  const cameraLocalPosition = useMemo(() => new THREE.Vector3(), [])
  const surfaceNormal = useMemo(
    () => position.clone().normalize(),
    [position]
  )

  useFrame(() => {
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
        onClick={(event) => {
          event.stopPropagation()
          onSelect(mission)
        }}
      >
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial
          color={selected ? '#FFFFFF' : '#39FF88'}
          depthTest={true}
        />
      </mesh>

      <mesh
        scale={1.8}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(mission)
        }}
      >
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial
          color="#39FF88"
          transparent
          opacity={0.15}
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
          className={`moon-marker-label ${selected ? 'active' : ''}`}
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
  onShowMission,
  moonGroup,
  dragging,
}) {
  const { camera, size } = useThree()
  const moonTransform = useMemo(() => {
    if (size.width <= 560) return { position: [0.1, 0, 0], scale: 0.55 }
    if (size.width <= 800) return { position: [0.3, 0, 0], scale: 0.68 }
    if (size.width <= 1050) return { position: [0.85, 0, 0], scale: 0.75 }
    return { position: [0.85, 0, 0], scale: 0.82 }
  }, [size.width])

  const cameraTarget = useRef(new THREE.Vector3(0, 0, 3.7))
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0))

  const focused = useRef(false)
  const cameraAnimating = useRef(false)

  // Prepara un acercamiento cinematográfico.
  const focusMission = useCallback((mission) => {
    if (!moonGroup.current || !mission) return

    const localPosition = getMoonPosition(
      mission.latitude,
      mission.longitude,
      MOON_RADIUS * 1.018
    )

    // Convierte la posición local a coordenadas del mundo.
    const center = moonGroup.current.getWorldPosition(new THREE.Vector3())
    const worldPosition = moonGroup.current.localToWorld(localPosition)
    const direction = worldPosition.clone().sub(center).normalize()

    lookTarget.current.copy(worldPosition)

    cameraTarget.current.copy(
      worldPosition.clone().add(
        direction.multiplyScalar(2.15)
      )
    )

    focused.current = true
    cameraAnimating.current = true
  }, [])

  // Permite enfocar misiones seleccionadas desde otros componentes.
  useEffect(() => {
    if (selectedMission) {
      focusMission(selectedMission)
    } else {
      focused.current = false

      lookTarget.current.set(0, 0, 0)
      cameraTarget.current.set(0, 0, 3.7)
      cameraAnimating.current = true
    }
  }, [selectedMission, focusMission])

  // Movimiento continuo y suave de la Luna y la cámara.
  useFrame((_, delta) => {
    if (!moonGroup.current) return

    const group = moonGroup.current

    if (dragging.current && focused.current) {
      focused.current = false
      cameraAnimating.current = false
      lookTarget.current.set(0, 0, 0)
      cameraTarget.current.set(0, 0, 3.7)
      camera.position.copy(cameraTarget.current)
      camera.lookAt(lookTarget.current)
    }

    if (!focused.current && !dragging.current) {
      group.rotation.y += delta * 0.035
    }

    if (cameraAnimating.current) {
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
        position={moonTransform.position}
        scale={moonTransform.scale}
      >
        <MoonModel />

        {missions.map((mission) => (
          <MissionMarker
            key={mission.id}
            mission={mission}
            selected={selectedMission?.id === mission.id}
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
  onShowMission,
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
          position: [0, 0, 3.7],
          fov: 38,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={1}
      >
        <color attach="background" args={['#000000']} />

        <Suspense fallback={null}>
          <MoonScene
            missions={missions}
            selectedMission={selectedMission}
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
