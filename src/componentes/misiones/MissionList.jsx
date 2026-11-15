import { ArrowUpRight } from 'lucide-react'
import sceneCatalog from '../../../data/apollo_scenes.json'
import '../../estilos/misiones/MissionList.css'

const assessmentLabels = {
  favorable: 'FAVORABLE',
  unfavorable: 'DESFAVORABLE',
  indeterminate: 'SIN DATOS SUFICIENTES',
}

function MissionList({ missions, onSelect, onHover }) {
  return (
    <div className="mission-list-content">
      <h2>Misiones<br /><em>históricas</em></h2>
      <p className="panel-description">Seis expediciones Apollo que hicieron historia en la superficie lunar.</p>
      <div className="mission-list">
        {missions.map((mission) => {
          const assessment = sceneCatalog.missions[mission.id]?.landing_assessment
          const status = assessment?.status ?? 'indeterminate'
          return (
          <button
            className="mission-list-item"
            key={mission.id}
            onClick={() => onSelect(mission)}
            onMouseEnter={() => onHover(mission)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="mission-thumb"><span>{mission.number}</span></span>
            <span className="mission-list-copy">
              <small>APOLLO · {mission.landingDate.toUpperCase()}</small>
              <strong>{mission.name}</strong>
              <em>{mission.site}</em>
              <span className={`mission-assessment-badge is-${status}`}>{assessmentLabels[status]}</span>
            </span>
            <ArrowUpRight size={16} />
          </button>
          )
        })}
      </div>
    </div>
  )
}

export default MissionList
