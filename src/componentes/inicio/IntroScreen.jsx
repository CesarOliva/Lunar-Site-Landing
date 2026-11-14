import { motion } from 'framer-motion'
import { ArrowDown, ArrowUpRight, Rocket } from 'lucide-react'
import '../../estilos/inicio/IntroScreen.css'

function IntroScreen({ onStart }) {
  return (
    <motion.section
      className="intro-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="intro-copy">
        <h1>La próxima<br /><em>frontera</em> lunar.</h1>
        <p>
          Explora las misiones que nos trajeron hasta aquí. Imagina los sitios
          donde volveremos a pisar la Luna.
        </p>
        <button className="primary-button launch-button" onClick={onStart}>
          Iniciar exploración <ArrowUpRight size={17} />
        </button>
      </div>
      <motion.div
        className="intro-moon"
        initial={{ scale: 0.9, x: 65 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ duration: 1.8, ease: [0.2, 0.7, 0.2, 1] }}
      />
      <motion.div
        className="spacecraft"
        initial={{ x: 0, y: 0, rotate: -9 }}
        animate={{ x: [0, 7, 0], y: [0, -8, 0], rotate: [-9, -6, -9] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Rocket size={56} strokeWidth={0.9} />
        <span className="craft-glow" />
      </motion.div>
      <div className="intro-coordinate">29° 58′ 31″ N<br />31° 07′ 52″ E</div>
    </motion.section>
  )
}

export default IntroScreen
