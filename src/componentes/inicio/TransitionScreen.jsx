import { motion } from 'framer-motion'
import '../../estilos/inicio/TransitionScreen.css'

function TransitionScreen() {
  return (
    <motion.section
      className="transition-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      aria-hidden="true"
    />
  )
}

export default TransitionScreen
