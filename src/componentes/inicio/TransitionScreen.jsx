import { motion } from 'framer-motion'
import { Rocket } from 'lucide-react'

function TransitionScreen() {
  return (
    <motion.section className="transition-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        className="transition-moon"
        initial={{ scale: 0.65, x: '13vw', y: '8vh' }}
        animate={{ scale: 2.4, x: '2vw', y: '0vh' }}
        transition={{ duration: 1.45, ease: [0.7, 0, 0.3, 1] }}
      />
      <motion.div
        className="transition-ship"
        initial={{ x: 0, y: 0, opacity: 1 }}
        animate={{ x: '48vw', y: '-32vh', opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.5, 0, 0.8, 0.4] }}
      ><Rocket size={50} /></motion.div>
      <span className="transition-label">ACERCÁNDONOS A LA LUNA</span>
    </motion.section>
  )
}

export default TransitionScreen
