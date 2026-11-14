import { ArrowLeft, Home } from 'lucide-react'
import '../../estilos/compartidos/PanelActions.css'

function PanelActions({ onBack, onHome }) {
  return (
    <div className="panel-top-actions">
      <button className="text-button" onClick={onBack}><ArrowLeft size={15} /> Regresar</button>
      <button className="icon-button" onClick={onHome} aria-label="Regresar al inicio"><Home size={16} /></button>
    </div>
  )
}

export default PanelActions
