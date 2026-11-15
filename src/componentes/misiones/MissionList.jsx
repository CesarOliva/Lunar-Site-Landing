import { ArrowUpRight, Sparkles } from 'lucide-react'
import '../../estilos/misiones/MissionList.css'

function MissionList({ missions, onSelect, onHover }) {
  return (
    <div className="mission-list-content">
      <h2>Misiones<br /><em>históricas</em></h2>
      <p className="panel-description">Seis expediciones Apollo que hicieron historia en la superficie lunar.</p>
      <div className="mission-list">
        {missions.map((mission) => (
          <button
            className="mission-list-item"
            key={mission.id}
            onClick={() => onSelect(mission)}
            onMouseEnter={() => onHover(mission)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="mission-thumb" style={{ '--mission-accent': mission.accent }}><span>{mission.number}</span></span>
            <span className="mission-list-copy"><small>APOLLO · {mission.landingDate.toUpperCase()}</small><strong>{mission.name}</strong><em>{mission.site}</em></span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default MissionList
