import { motion } from 'framer-motion'
import '../../estilos/misiones/MissionRainPanel.css'

// Cuántas veces se repite el texto dentro de cada columna.
// Con 6 copias el loop cubre pantallas de hasta ~1800px de alto sin dejar huecos.
const COPIES = 6

function RainColumn({ items, direction }) {
  const totalChars = items.reduce((sum, text) => sum + text.length, 0)
  // Velocidad: sube el 0.5 para ir más lento, bájalo para ir más rápido.
  const duration = Math.max(10, totalChars * 0.5)

  const drops = items.map((text, itemIndex) => {
    const chars = Array.from(text)
    const last = Math.max(chars.length - 1, 1)

    return (
      <div className={`rain-item${itemIndex > 0 ? ' is-secondary' : ''}`} key={itemIndex}>
        {chars.map((char, i) => {
          if (char === ' ') return <span className="rain-space" key={i} />

          // 1 = la letra que va al frente de la gota (brillante), 0 = el final de la estela
          const closeness = direction === 'down' ? i / last : 1 - i / last

          return (
            <span
              className={`rain-char${closeness === 1 ? ' is-head' : ''}`}
              style={{ '--p': closeness }}
              key={i}
            >
              {char}
            </span>
          )
        })}
        <span className="rain-divider" />
      </div>
    )
  })

  return (
    <div className={`rain-column is-${direction}`} aria-hidden="true">
      <div
        className="rain-track"
        style={{ '--rain-duration': `${duration}s`, '--rain-shift': `${100 / COPIES}%` }}
      >
        {Array.from({ length: COPIES }, (_, copy) => (
          <div className="rain-block" key={copy}>{drops}</div>
        ))}
      </div>
    </div>
  )
}

function MissionRainPanel({ mission }) {
  // Columna 1 baja: nombre y número de la misión
  const missionColumn = [mission.name, `Misión ${mission.number}`]
  // Columna 2 sube: sitio de alunizaje y vehículo
  const siteColumn = [mission.site, mission.vehicle]

  return (
    <motion.aside
      className="rain-panel"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
    >
      {/* Texto completo para lectores de pantalla (las columnas están ocultas para ellos) */}
      <p className="rain-sr">
        {`${mission.name}, misión ${mission.number}. Sitio de alunizaje: ${mission.site}. Vehículo: ${mission.vehicle}.`}
      </p>

      <RainColumn items={missionColumn} direction="down" />
      <RainColumn items={siteColumn} direction="up" />
    </motion.aside>
  )
}

export default MissionRainPanel