import { motion } from 'framer-motion'
import { ArrowRight, Compass, Orbit } from 'lucide-react'
import '../../estilos/inicio/HomeScreen.css'

function HomeScreen({ missions, selectedMission, onShowMission, onOpenMissions, onOpenPlanning }) {
  return (
    <motion.section className="home-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="home-moon">
        <div className="moon-shadow" />
        <div className="moon-craters" />
        <div className="moon-atmosphere" />
        {missions.map((mission) => (
          <button
            className={`mission-marker ${selectedMission?.id === mission.id ? 'is-selected' : ''}`}
            key={mission.id}
            style={mission.position}
            aria-label={`Explorar ${mission.name}`}
            onClick={() => onShowMission(mission)}
          >
            <span className="marker-pulse" />
            <span className="marker-label">{mission.number} / {mission.name}</span>
          </button>
        ))}
      </div>
      <div className="home-vignette" />

      <div className="home-intro">
        <h2>Un pequeño paso.<br /><em>Un mundo</em> por descubrir.</h2>
        <p>Selecciona un punto en la Luna o explora el archivo de misiones históricas.</p>
        <div className="home-actions">
          <button className="menu-option" onClick={onOpenMissions}>
            <span><strong>Misiones históricas</strong></span>
            <ArrowRight size={16} className="option-arrow" />
          </button>
          <button className="menu-option option-disabled" onClick={onOpenPlanning}>
            <span><strong>Planeación de viaje</strong></span>
            <ArrowRight size={16} className="option-arrow" />
          </button>
        </div>
      </div>

    </motion.section>
  )
}

export default HomeScreen
