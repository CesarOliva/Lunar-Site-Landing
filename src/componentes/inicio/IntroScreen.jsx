import { useEffect } from 'react'
import { motion } from 'framer-motion'
import '../../estilos/inicio/IntroScreen.css'

function IntroScreen({ onStart }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      event.preventDefault()
      onStart()
    }

    const handleScroll = (event) => {
      event.preventDefault()
      onStart()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleScroll, { passive: false })
    window.addEventListener('touchmove', handleScroll, { passive: false })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleScroll)
      window.removeEventListener('touchmove', handleScroll)
    }
  }, [onStart])

  return (
    <motion.section
      className="intro-screen"
      aria-label="Presiona cualquier tecla o desplázate para acercarte a la Luna"
      onClick={onStart}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    />
  )
}

export default IntroScreen
