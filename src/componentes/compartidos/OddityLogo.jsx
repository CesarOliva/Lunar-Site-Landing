import '../../estilos/compartidos/OddityLogo.css'

function OddityLogo({ className = '' }) {
  return (
    <span className={`oddity-logo-crop ${className}`.trim()}>
      <img src="/images/oddity-logo.png" alt="Oddity" draggable="false" />
    </span>
  )
}

export default OddityLogo
