import { motion } from 'framer-motion'
import { ArrowLeft, Home } from 'lucide-react'
import MissionRainPanel from './MissionRainPanel.jsx'
import MissionTimeline from './MissionTimeline.jsx'
import '../../estilos/misiones/TimelineScreen.css'

function TimelineScreen({ mission, onBack, onHome }) {
  return (
    <motion.section className="timeline-screen" initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }}>
      {/* Letras de fondo: ocupan toda la pantalla, detrás de todo el contenido */}
      <MissionRainPanel mission={mission} />

      <div className="timeline-topline">
        <button className="icon-button" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>
        <span></span>
        <button className="icon-button" onClick={onHome} aria-label="Go to home"><Home size={17} /></button>
      </div>

      {/* Línea de tiempo horizontal con la nave */}
      <MissionTimeline events={mission.timeline} />
    </motion.section>
  )
}

export default TimelineScreen