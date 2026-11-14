import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'

function MissionPreview({ mission, slide, onSlide, onExplore }) {
  return (
    <div className="preview-content">
      <div className="preview-hero" style={{ '--mission-accent': mission.accent }}>
        <AnimatePresence mode="wait">
          <motion.div
            className={`preview-image preview-image-${slide}`}
            key={`${mission.id}-${slide}`}
            style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(5,7,13,.78)), url("${mission.image}")` }}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        </AnimatePresence>
        <span className="hero-tag"><span className="live-dot" /> {mission.site.toUpperCase()}</span>
        <div className="hero-controls">
          <span>0{slide + 1} <i /> 03</span>
          <button onClick={() => onSlide(-1)} aria-label="Imagen anterior"><ChevronLeft size={17} /></button>
          <button onClick={() => onSlide(1)} aria-label="Imagen siguiente"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="preview-details">
        <span className="mission-kicker">MISIÓN {mission.number} <i /> ARCHIVO NASA</span>
        <h2>{mission.name}</h2>
        <p className="mission-dates"><span>FECHAS DE MISIÓN</span>{mission.dates}</p>

        <section className="detail-section">
          <span className="section-label">TRIPULACIÓN <i /></span>
          <div className="crew-list">
            {mission.crew.map((person, index) => (
              <div className="crew-member" key={person.name}>
                <span className="crew-number">0{index + 1}</span>
                <span><strong>{person.name}</strong><small>{person.role}</small></span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section purpose-section">
          <span className="section-label">PROPÓSITO DE LA MISIÓN <i /></span>
          <p>{mission.purpose}</p>
          <p className="mission-description">{mission.description}</p>
        </section>

        <button className="primary-button explore-button" onClick={onExplore}>
          Explorar misión <ArrowUpRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default MissionPreview
