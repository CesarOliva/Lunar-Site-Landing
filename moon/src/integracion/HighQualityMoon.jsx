import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { loadHighQualityMoon } from './highQualityMoon.js'

const FADE_IN_SECONDS = 0.9

/**
 * Luna de calidad alta (256 teselas de NASA Trek) para escenas de react-three-fiber.
 * No muestra nada hasta que termina de descargarse (o `fallback`, si se da) y entonces aparece con un
 * fundido de opacidad, para que no haya un salto brusco ni se vea ninguna otra luna antes.
 */
export default function HighQualityMoon({ radius = 1.1, fallback = null, onReady }) {
  const [moon, setMoon] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadHighQualityMoon({ radius })
      .then((loaded) => {
        if (cancelled) return
        // La luna se reutiliza entre pantallas: cada vez que se monta vuelve a aparecer con fundido.
        loaded.object.traverse((child) => {
          if (child.isMesh) {
            child.material.transparent = true
            child.material.opacity = 0
          }
        })
        setMoon(loaded)
        onReady?.(loaded)
      })
      .catch((error) => console.warn('No se pudo cargar la luna de alta calidad:', error))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius])

  useFrame((_, delta) => {
    if (!moon) return
    moon.object.traverse((child) => {
      if (!child.isMesh || child.material.opacity >= 1) return
      const material = child.material
      material.opacity = Math.min(1, material.opacity + delta / FADE_IN_SECONDS)
      if (material.opacity >= 1) {
        material.transparent = false // sin transparencia al terminar: mejor orden de dibujo y rendimiento
        material.needsUpdate = true
      }
    })
  })

  return moon ? <primitive object={moon.object} /> : fallback
}
