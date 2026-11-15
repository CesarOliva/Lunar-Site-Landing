import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera, useGLTF } from '@react-three/drei'

const SHIP_MODEL = '/modelos/Nave_espacial.glb'
const MODEL_LENGTH = 2 // largo de la nave en unidades de escena (de -1 a 1 en X)
const VIEW_WIDTH = 2.3 // unidades visibles a lo ancho: deja un margen alrededor de la nave

/*
 * Orientación del modelo (medida en Nave_espacial.glb): el eje largo es X con la nariz hacia +X, el
 * "arriba" (deriva vertical) es +Z y la envergadura va por Y. Girado -90° sobre X y visto desde +Z queda
 * de perfil, paralelo a la pantalla, con la nariz a la derecha, igual que apuntaba la nave 2D.
 */
const SIDE_VIEW_ROTATION = [-Math.PI / 2, 0, 0]

function Ship() {
  const { scene } = useGLTF(SHIP_MODEL)
  const { size, invalidate } = useThree()

  // Se centra y se escala para que el largo valga MODEL_LENGTH, sin tocar el modelo original (caché de drei).
  const ship = useMemo(() => {
    const clone = scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const dimensions = bounds.getSize(new THREE.Vector3())
    const longest = Math.max(dimensions.x, dimensions.y, dimensions.z)
    const scale = longest > 0 ? MODEL_LENGTH / longest : 1
    clone.scale.setScalar(scale)
    clone.position.copy(center).multiplyScalar(-scale)
    return clone
  }, [scene])

  // El modelo es estático (no se reproducen sus animaciones): se dibuja una vez al cargar y al cambiar de tamaño.
  useEffect(() => { invalidate() }, [ship, size.width, size.height, invalidate])

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={size.width / VIEW_WIDTH} near={0.1} far={50} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-2, 3, 5]} intensity={2.6} />
      <directionalLight position={[3, -2, 2]} intensity={0.8} color="#9fe8b9" />
      <group rotation={SIDE_VIEW_ROTATION}>
        <primitive object={ship} />
      </group>
    </>
  )
}

/**
 * Nave espacial 3D de la línea del tiempo, vista de perfil. Ocupa su contenedor (que fija el tamaño y
 * recibe el desplazamiento y el giro desde MissionTimeline); el fondo es transparente.
 */
export default function TimelineShip() {
  return (
    <Canvas
      className="timeline-ship-canvas"
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      // El contenedor se inclina con la trayectoria: su getBoundingClientRect() crece al girar y deformaba el
      // canvas. offsetSize usa el tamaño de layout, que no cambia con la rotación.
      resize={{ offsetSize: true, scroll: false }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Ship />
      </Suspense>
    </Canvas>
  )
}
