import { ArrowLeft, Home, X } from 'lucide-react'
import '../../estilos/compartidos/PanelActions.css'

function PanelActions({ onBack, onHome, onClose }) {
  return (
    <div className="panel-top-actions">
      <button className="text-button" onClick={onBack}><ArrowLeft size={15} /> Regresar</button>
      <button className="icon-button" onClick={onHome} aria-label="Regresar al inicio"><Home size={16} /></button>
      <button className="icon-button" onClick={onClose} aria-label="Cerrar panel"><X size={16} /></button>
    </div>
  )
}

export default PanelActions
