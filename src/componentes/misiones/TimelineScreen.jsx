import { motion } from 'framer-motion'
import { ArrowLeft, Home } from 'lucide-react'

function TimelineScreen({ mission, onBack, onHome }) {
  return (
    <motion.section className="timeline-screen" initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }}>
      <div className="timeline-moon" />
      <div className="timeline-topline">
        <button className="icon-button" onClick={onBack} aria-label="Regresar"><ArrowLeft size={18} /></button>
        <span>ARCHIVO DE MISIONES <i /> {mission.number} / 06</span>
        <button className="icon-button" onClick={onHome} aria-label="Ir al inicio"><Home size={17} /></button>
      </div>
      <div className="timeline-content">
        <span className="eyebrow"><span className="live-dot" /> REGISTRO DE MISIÓN · {mission.landingDate.toUpperCase()}</span>
        <h1>{mission.name}<br /><em>Expedición lunar</em></h1>
        <p className="timeline-lead">{mission.purpose}</p>
        <div className="timeline-meta">
          <span><small>SITIO DE ALUNIZAJE</small>{mission.site}</span>
          <span><small>VEHÍCULO</small>{mission.vehicle}</span>
        </div>
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
        <button className="text-button" onClick={onBack}><ArrowLeft size={15} /> Volver a la misión</button>
      </div>
    </motion.section>
  )
}

export default TimelineScreen
