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
        <span className="eyebrow"><span className="live-dot" /> EXPLORACIÓN LUNAR</span>
        <h2>Un pequeño paso.<br /><em>Un mundo</em> por descubrir.</h2>
        <p>Selecciona un punto en la Luna o explora el archivo de misiones históricas.</p>
        <div className="home-actions">
          <button className="menu-option" onClick={onOpenMissions}>
            <span className="option-icon"><Orbit size={19} /></span>
            <span><strong>Misiones históricas</strong><small>Revive la exploración lunar</small></span>
            <ArrowRight size={16} className="option-arrow" />
          </button>
          <button className="menu-option option-disabled" onClick={onOpenPlanning}>
            <span className="option-icon"><Compass size={19} /></span>
            <span><strong>Planeación de viaje</strong><small>Próximamente · elige un sitio de aterrizaje</small></span>
            <ArrowRight size={16} className="option-arrow" />
          </button>
        </div>
      </div>

      <div className="home-caption"><span className="caption-line" /> POLO SUR LUNAR <span>89° S</span></div>
      <div className="home-index"><span>01</span><i /> 03</div>
      <div className="home-bottom-note">UNA NUEVA PERSPECTIVA<br />DE NUESTRO VECINO CELESTE</div>
    </motion.section>
  )
}

export default HomeScreen
