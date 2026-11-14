import { ArrowLeft, Compass } from 'lucide-react'
import '../../estilos/planificacion/PlanningPanel.css'

function PlanningPanel({ onHome }) {
  return (
    <div className="planning-placeholder">
      <span className="eyebrow">SIGUIENTE FASE</span>
      <h2>Planeación<br /><em>de viaje</em></h2>
      <p>Estamos preparando herramientas para comparar sitios de aterrizaje, iluminación y ventanas de comunicación.</p>
      <div className="placeholder-card"><Compass size={21} /><span><strong>Explorador del polo sur</strong><small>La experiencia de planeación llegará pronto.</small></span></div>
      <button className="text-button" onClick={onHome}><ArrowLeft size={15} /> Volver al inicio</button>
    </div>
  )
}

export default PlanningPanel
