import { useEffect, useRef, useState } from 'react'
import { Coins, GraduationCap } from 'lucide-react'
import '../../estilos/Creditos/CreditosScreen.css'

const offers = [
  {
    id: 'student',
    title: 'Student plan',
    credits: 100,
    price: 0,
    cadence: 'per month',
    description: 'Register a university account to receive free credits every month.',
    featured: true,
  },
  {
    id: '10-credits',
    title: '10 credits',
    credits: 10,
    price: 5,
    description: 'A top-up to start exploring.',
  },
  {
    id: '50-credits',
    title: '50 credits',
    credits: 50,
    price: 25,
    description: 'More credits to continue your lunar exploration.',
  },
  {
    id: '100-credits',
    title: '100 credits',
    credits: 100,
    price: 50,
    description: 'The largest top-up for your upcoming missions.',
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
      ? `${selectedOffer.credits} demo credits were added to the balance. University registration and validation are not performed in this view.`
      : `${selectedOffer.credits} demo credits were added to the balance. No payment was processed.`)
    closeConfirmation()
  }

  return (
    <section className="credits-screen" aria-labelledby="credits-title">
      <header className="credits-heading">
        <p className="credits-eyebrow">EXPLORATION CENTER</p>
        <h2 id="credits-title">Top up <em>credits</em></h2>
        <p className="credits-description">
          Choose an option to continue your journey around the Moon.
          <strong> 1 credit = $0.50 USD</strong>
        </p>
        <p className="credits-demo-note">Demo view: top-ups are reflected in the balance, with no payments or registrations processed.</p>
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
              {offer.featured && <span className="credits-card-badge">FREE</span>}
            </div>
            <h3>{offer.title}</h3>
            <p className="credits-card-description">{offer.description}</p>
            <div className="credits-card-value">
              <strong>{offer.credits}</strong>
              <span>{offer.cadence ? `credits ${offer.cadence}` : 'credits'}</span>
            </div>
            <p className="credits-card-price">
              {offer.featured ? 'Free' : `$${offer.price.toFixed(2)} USD`}
              {offer.featured && <span> per month</span>}
            </p>
            {offer.featured && (
              <p className="credits-card-requirement">
                University account validation is not included in this view.
              </p>
            )}
            <button
              className="credits-recharge-button"
              type="button"
              onClick={(event) => openConfirmation(offer, event)}
              aria-label={`Top up: ${offer.title}`}
            >
              <Coins size={16} />
              Top up
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
              {selectedOffer.featured ? 'CONFIRM PLAN' : 'CONFIRM TOP-UP'}
            </p>
            <h3 id="credits-dialog-title">{selectedOffer.title}</h3>
            <p className="credits-dialog-question">Are you sure you want to continue?</p>
            <div className="credits-dialog-summary">
              <span>You will receive</span>
              <strong>
                {selectedOffer.credits} credits
                {selectedOffer.featured ? ' free per month' : ''}
              </strong>
              <span>{selectedOffer.featured ? 'Monthly cost' : 'Total'}</span>
              <strong>{selectedOffer.featured ? 'Free' : `$${selectedOffer.price.toFixed(2)} USD`}</strong>
            </div>
            {selectedOffer.featured && (
              <p className="credits-dialog-note">
                The plan requires registering a university account. It is neither requested nor validated in this view.
              </p>
            )}
            <div className="credits-dialog-actions">
              <button className="credits-confirm-button" type="button" onClick={confirmOffer}>
                Top up
              </button>
              <button className="credits-cancel-button" type="button" onClick={closeConfirmation}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}

export default CreditosScreen