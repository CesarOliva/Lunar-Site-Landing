import { useEffect, useRef } from 'react'

function StarField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    let width = 0
    let height = 0
    let lastFrame = 0
    let animationFrame = 0
    let particles = []

    const draw = (delta) => {
      context.clearRect(0, 0, width, height)

      particles.forEach((particle) => {
        particle.x += particle.velocityX * delta
        particle.y += particle.velocityY * delta
        particle.phase += particle.twinkleSpeed * delta

        if (particle.x < 0) particle.x = width
        if (particle.x > width) particle.x = 0
        if (particle.y < 0) particle.y = height
        if (particle.y > height) particle.y = 0

        const pulse = particle.twinkle
          ? Math.max(0, Math.sin(particle.phase)) * 0.24
          : 0
        const opacity = particle.opacity * (1 + pulse)

        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fillStyle = particle.green
          ? `rgba(57, 255, 136, ${opacity})`
          : `rgba(255, 255, 255, ${opacity})`
        context.fill()
      })
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)

      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      const count = Math.min(
        300,
        Math.max(120, Math.round((width * height) / 3500))
      )

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() < 0.08
          ? 1.25 + Math.random() * 0.8
          : 0.45 + Math.random() * 1,
        velocityX: (Math.random() - 0.5) * 0.8,
        velocityY: (Math.random() - 0.5) * 0.8,
        opacity: 0.24 + Math.random() * 0.42,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.4 + Math.random() * 1,
        twinkle: Math.random() < 0.3,
        green: Math.random() < 0.04,
      }))

      draw(0)
    }

    const animate = (timestamp) => {
      if (timestamp - lastFrame >= 40) {
        const delta = lastFrame
          ? Math.min((timestamp - lastFrame) / 1000, 0.05)
          : 0
        lastFrame = timestamp
        draw(delta)
      }

      animationFrame = window.requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', resize)

    if (!reduceMotion) {
      animationFrame = window.requestAnimationFrame(animate)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="star-field" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}

export default StarField
