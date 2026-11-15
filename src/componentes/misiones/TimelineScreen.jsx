import { motion } from 'framer-motion'
import { ArrowLeft, Home } from 'lucide-react'
import MissionRainPanel from './MissionRainPanel.jsx'
import '../../estilos/misiones/TimelineScreen.css'

function TimelineScreen({ mission, onBack, onHome }) {
  return (
    <motion.section className="timeline-screen" initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }}>
      <div className="timeline-moon" />

      {/* Letras de fondo: ocupan toda la pantalla, detrás de todo el contenido */}
      <MissionRainPanel mission={mission} />

      <div className="timeline-topline">
        <button className="icon-button" onClick={onBack} aria-label="Regresar"><ArrowLeft size={18} /></button>
        <span></span>
        <button className="icon-button" onClick={onHome} aria-label="Ir al inicio"><Home size={17} /></button>
      </div>

      <div className="timeline-layout">
        <div className="timeline-content">
          <div className="timeline-track">
            {mission.timeline.map((event, index) => (
              <motion.article className="timeline-event" key={event.time} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.12 }}>
                <span className="timeline-point" />
                <small>{event.time}</small>
                <h3>{event.title}</h3>
                <p>{event.detail}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

export default TimelineScreen