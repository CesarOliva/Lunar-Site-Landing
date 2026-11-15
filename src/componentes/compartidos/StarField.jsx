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

        const opacity = particle.opacity * (
          0.65 + (Math.sin(particle.phase) + 1) * 0.175
        )

        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fillStyle = particle.green
          ? `rgba(140, 255, 190, ${opacity})`
          : `rgba(220, 235, 245, ${opacity})`
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
        100,
        Math.max(45, Math.round((width * height) / 12000))
      )

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.35 + Math.random() * 0.9,
        velocityX: (Math.random() - 0.5) * 1.1,
        velocityY: (Math.random() - 0.5) * 1.1,
        opacity: 0.18 + Math.random() * 0.38,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.3 + Math.random() * 0.8,
        green: Math.random() < 0.18,
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
