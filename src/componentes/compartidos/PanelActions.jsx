import { ArrowLeft, Coins, Home } from 'lucide-react'
import '../../estilos/compartidos/PanelActions.css'

function PanelActions({ onBack, onHome, onCredits, creditsBalance }) {
  return (
    <div className="panel-top-actions">
      <button className="text-button" onClick={onBack}><ArrowLeft size={15} /> Back</button>
      {onCredits && (
        <button
          className="credits-button"
          onClick={onCredits}
          aria-label={`Balance: ${creditsBalance} credits`}
          title={`${creditsBalance} credits`}
        >
          <Coins size={15} /> <span>{creditsBalance}</span>
        </button>
      )}
      <button className="icon-button" onClick={onHome} aria-label="Back to home"><Home size={16} /></button>
    </div>
  )
}

export default PanelActions
