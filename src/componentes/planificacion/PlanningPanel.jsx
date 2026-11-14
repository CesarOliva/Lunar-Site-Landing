import { Compass } from 'lucide-react'
import '../../estilos/planificacion/PlanningPanel.css'

function PlanningPanel() {
  return (
    <div className="planning-placeholder">
      <h2>Planeación<br /><em>de viaje</em></h2>
      <p>Estamos preparando herramientas para comparar sitios de aterrizaje, iluminación y ventanas de comunicación.</p>
      <div className="placeholder-card"><Compass size={21} /><span><strong>Explorador del polo sur</strong><small>La experiencia de planeación llegará pronto.</small></span></div>
    </div>
  )
}

export default PlanningPanel
