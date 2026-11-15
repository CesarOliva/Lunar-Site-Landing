import { useEffect, useRef, useState } from 'react'
import { Coins, GraduationCap } from 'lucide-react'
import '../../estilos/Creditos/CreditosScreen.css'

const offers = [
  {
    id: 'student',
    title: 'Plan estudiantil',
    credits: 100,
    price: 0,
    cadence: 'al mes',
    description: 'Registra una cuenta universitaria para recibir créditos gratis cada mes.',
    featured: true,
  },
  {
    id: '10-credits',
    title: '10 créditos',
    credits: 10,
    price: 5,
    description: 'Una recarga para comenzar a explorar.',
  },
  {
    id: '50-credits',
    title: '50 créditos',
    credits: 50,
    price: 25,
    description: 'Más créditos para continuar tu exploración lunar.',
  },
  {
    id: '100-credits',
    title: '100 créditos',
    credits: 100,
    price: 50,
    description: 'La recarga más amplia para tus próximas misiones.',
  },
]

function CreditosScreen({ onRecharge }) {
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [notice, setNotice] = useState('')
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (selectedOffer && !dialog.open) {
      dialog.showModal()
      dialog.querySelector('.credits-confirm-button')?.focus()
    } else if (!selectedOffer && dialog.open) {
      dialog.close()
      triggerRef.current?.focus()
    }
  }, [selectedOffer])

  const openConfirmation = (offer, event) => {
    triggerRef.current = event.currentTarget
    setNotice('')
    setSelectedOffer(offer)
  }

  const closeConfirmation = () => setSelectedOffer(null)

  const confirmOffer = () => {
    if (!selectedOffer) return

    onRecharge(selectedOffer.credits)
    setNotice(selectedOffer.featured
      ? `Se sumaron ${selectedOffer.credits} créditos de demostración al saldo. El registro y la validación universitaria no se realizan en esta vista.`
      : `Se sumaron ${selectedOffer.credits} créditos de demostración al saldo. No se procesó ningún pago.`)
    closeConfirmation()
  }

  return (
    <section className="credits-screen" aria-labelledby="credits-title">
      <header className="credits-heading">
        <p className="credits-eyebrow">CENTRO DE EXPLORACIÓN</p>
        <h2 id="credits-title">Recarga <em>créditos</em></h2>
        <p className="credits-description">
          Elige una opción para continuar tu recorrido por la Luna.
          <strong> 1 crédito = $0.50 USD</strong>
        </p>
        <p className="credits-demo-note">Vista de demostración: las recargas se reflejan en el saldo, sin procesar pagos ni registros.</p>
      </header>

      {notice && <p className="credits-notice" role="status">{notice}</p>}

      <div className="credits-grid">
        {offers.map((offer) => (
          <article
            className={`credits-card ${offer.featured ? 'credits-card-student' : ''}`}
            key={offer.id}
          >
            <div className="credits-card-heading">
              <span className="credits-card-icon">
                {offer.featured ? <GraduationCap size={19} /> : <Coins size={19} />}
              </span>
              {offer.featured && <span className="credits-card-badge">GRATIS</span>}
            </div>
            <h3>{offer.title}</h3>
            <p className="credits-card-description">{offer.description}</p>
            <div className="credits-card-value">
              <strong>{offer.credits}</strong>
              <span>{offer.cadence ? `créditos ${offer.cadence}` : 'créditos'}</span>
            </div>
            <p className="credits-card-price">
              {offer.featured ? 'Gratis' : `$${offer.price.toFixed(2)} USD`}
              {offer.featured && <span> al mes</span>}
            </p>
            {offer.featured && (
              <p className="credits-card-requirement">
                La validación de la cuenta universitaria no está incluida en esta vista.
              </p>
            )}
            <button
              className="credits-recharge-button"
              type="button"
              onClick={(event) => openConfirmation(offer, event)}
              aria-label={`Recargar: ${offer.title}`}
            >
              <Coins size={16} />
              Recargar
            </button>
          </article>
        ))}
      </div>

      <dialog
        className="credits-confirm-dialog"
        ref={dialogRef}
        aria-labelledby="credits-dialog-title"
        onCancel={(event) => {
          event.preventDefault()
          closeConfirmation()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeConfirmation()
        }}
      >
        {selectedOffer && (
          <div className="credits-dialog-content">
            <p className="credits-eyebrow">
              {selectedOffer.featured ? 'CONFIRMAR PLAN' : 'CONFIRMAR RECARGA'}
            </p>
            <h3 id="credits-dialog-title">{selectedOffer.title}</h3>
            <p className="credits-dialog-question">¿Estás seguro de que quieres continuar?</p>
            <div className="credits-dialog-summary">
              <span>Recibirás</span>
              <strong>
                {selectedOffer.credits} créditos
                {selectedOffer.featured ? ' gratis al mes' : ''}
              </strong>
              <span>{selectedOffer.featured ? 'Costo mensual' : 'Total'}</span>
              <strong>{selectedOffer.featured ? 'Gratis' : `$${selectedOffer.price.toFixed(2)} USD`}</strong>
            </div>
            {selectedOffer.featured && (
              <p className="credits-dialog-note">
                El plan requiere registrar una cuenta universitaria. No se solicita ni valida desde esta vista.
              </p>
            )}
            <div className="credits-dialog-actions">
              <button className="credits-confirm-button" type="button" onClick={confirmOffer}>
                Recargar
              </button>
              <button className="credits-cancel-button" type="button" onClick={closeConfirmation}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}

export default CreditosScreen