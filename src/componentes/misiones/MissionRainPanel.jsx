import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import '../../estilos/misiones/MissionRainPanel.css'

// Cuántas veces se repite el texto dentro de cada columna.
// Con 6 copias el loop cubre pantallas de hasta ~1800px de alto sin dejar huecos.
const COPIES = 6

// Intro con glitch: a partir de INTRO_MS todas las letras están correctas y fijas.
const INTRO_MS = 1000
const FRAME_MS = 40 // cada cuánto cambian las letras mientras glitchean
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*<>/=+'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Cada letra aparece en un momento aleatorio (0–560 ms) y glitchea entre 180 y 340 ms,
// así que la última queda lista a los ~900 ms.
const makePlan = () => ({ start: Math.random() * 560, length: 180 + Math.random() * 160 })

// Reloj único para toda la intro: sube de 0 a INTRO_MS y se detiene.
function useIntroClock() {
  const [elapsed, setElapsed] = useState(() => (prefersReducedMotion() ? INTRO_MS : 0))

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const time = Math.min(performance.now() - startedAt, INTRO_MS)
      setElapsed(time)
      if (time >= INTRO_MS) window.clearInterval(timer)
    }, FRAME_MS)
    return () => window.clearInterval(timer)
  }, [])

  return elapsed
}

function RainColumn({ items, plans, direction, elapsed, seed }) {
  const totalChars = items.reduce((sum, text) => sum + text.length, 0)
  const frame = Math.floor(elapsed / FRAME_MS)
  const inIntro = elapsed < INTRO_MS

  const drops = items.map((text, itemIndex) => {
    const chars = Array.from(text)
    const last = Math.max(chars.length - 1, 1)

    return (
      <div className={`rain-item${itemIndex > 0 ? ' is-secondary' : ''}`} key={itemIndex}>
        {chars.map((char, i) => {
          if (char === ' ') return <span className="rain-space" key={i} />

          // 1 = la letra que va al frente de la gota (brillante), 0 = el final de la estela
          const closeness = direction === 'down' ? i / last : 1 - i / last
          const plan = plans[itemIndex][i]
          const charSeed = seed + itemIndex * 97 + i * 13

          let shown = char
          let state = ''
          const style = { '--p': closeness }

          if (inIntro) {
            if (elapsed < plan.start) {
              state = ' is-hidden' // todavía no aparece
            } else if (elapsed < plan.start + plan.length) {
              state = ' is-glitch' // letra aleatoria + temblor
              shown = GLYPHS[(charSeed + frame * 17) % GLYPHS.length]
              style['--gx'] = `${((charSeed + frame) % 5) - 2}px`
            }
          }

          return (
            <span className={`rain-char${closeness === 1 ? ' is-head' : ''}${state}`} style={style} key={i}>
              {shown}
            </span>
          )
        })}
        <span className="rain-divider" />
      </div>
    )
  })

  return (
    <div className={`rain-column is-${direction}`} aria-hidden="true">
      <div className="rain-track" style={{ '--chars': totalChars, '--rain-shift': `${100 / COPIES}%` }}>
        {Array.from({ length: COPIES }, (_, copy) => (
          <div className="rain-block" key={copy}>{drops}</div>
        ))}
      </div>
    </div>
  )
}

function MissionRainPanel({ mission }) {
  const elapsed = useIntroClock()

  // Columna 1 baja: nombre y número de la misión
  // Columna 2 sube: sitio de alunizaje y vehículo
  const columns = useMemo(
    () =>
      [
        { direction: 'down', items: [mission.name, `Mission ${mission.number}`] },
        { direction: 'up', items: [mission.site, mission.vehicle] },
      ].map((column) => ({
        ...column,
        plans: column.items.map((text) => Array.from(text).map(makePlan)),
      })),
    [mission],
  )

  return (
    <motion.aside
      className="rain-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Texto completo para lectores de pantalla (las columnas están ocultas para ellos) */}
      <p className="rain-sr">
        {`${mission.name}, mission ${mission.number}. Landing site: ${mission.site}. Vehicle: ${mission.vehicle}.`}
      </p>

      {columns.map((column, index) => (
        <RainColumn key={column.direction} {...column} seed={index * 31} elapsed={elapsed} />
      ))}
    </motion.aside>
  )
}

export default MissionRainPanel