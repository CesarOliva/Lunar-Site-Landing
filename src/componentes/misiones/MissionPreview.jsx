import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Footprints } from 'lucide-react'
import MissionAssessment from './MissionAssessment.jsx'
import '../../estilos/misiones/MissionPreview.css'

function MissionPreview({ mission, slide, onSlide, onExplore, onSurface, onSceneChange }) {
  return (
    <div className="preview-content">
      <div className="preview-hero">
        <AnimatePresence mode="wait">
          <motion.div
            className={`preview-image preview-image-${slide}`}
            key={`${mission.id}-${slide}`}
            style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(3,6,5,.82)), url("${mission.image}")` }}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        </AnimatePresence>
        <span className="hero-mission-dates">{mission.dates}</span>
        <div className="hero-indicators" role="group" aria-label="Mission images">
          {Array.from({ length: 3 }, (_, index) => (
            <button
              className={`hero-indicator ${slide === index ? 'is-active' : ''}`}
              key={index}
              aria-label={`View image ${index + 1}`}
              aria-pressed={slide === index}
              onClick={() => onSlide(index - slide)}
            />
          ))}
        </div>
      </div>
      <div className="preview-details">
        <h2>{mission.name} - Mission {mission.number}</h2>

        <section className="detail-section">
          <span className="section-label">Crew <i /></span>
          <div className="crew-list">
            {mission.crew.map((person, index) => (
              <div className="crew-member" key={person.name}>
                <span><strong>{person.name}</strong><small>{person.role}</small></span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section purpose-section">
          <span className="section-label">Mission purpose <i /></span>
          <p>{mission.purpose}</p>
          <p className="mission-description">{mission.description}</p>
        </section>

        <MissionAssessment key={mission.id} mission={mission} onSceneChange={onSceneChange} />

        <button className="primary-button explore-button" onClick={onExplore}>
          Explore mission <ArrowUpRight size={17} />
        </button>

        {onSurface && (
          <button className="primary-button surface-button" onClick={onSurface}>
            Lunar explorer · first person <Footprints size={17} />
          </button>
        )}
      </div>
    </div>
  )
}

export default MissionPreview
