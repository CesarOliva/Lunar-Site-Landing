import { motion } from 'framer-motion'
import { Footprints } from 'lucide-react'
import { formatLatitude, formatLongitude } from './coordinates.js'
import '../../estilos/superficie/SurfaceInvite.css'

/**
 * Aparece sobre el mapa al seleccionar un punto: ofrece entrar directamente en primera persona
 * en esas mismas coordenadas (las del punto seleccionado, sin modificar).
 */
export default function SurfaceInvite({ target, onOpen }) {
  return (
    <motion.div
      className="surface-invite"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="section-label">Explorador lunar <i /></span>
      <strong className="surface-invite-title">{target.mission.name}</strong>
      <span className="surface-invite-site">{target.mission.site}</span>
      <p className="surface-invite-coords">
        <span>{formatLatitude(target.latitude)}</span>
        <span>{formatLongitude(target.longitude)}</span>
      </p>
      <button className="primary-button surface-invite-button" onClick={onOpen}>
        Entrar en primera persona <Footprints size={17} />
      </button>
    </motion.div>
  )
}
