import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import OddityLogo from '../compartidos/OddityLogo.jsx'
import '../../estilos/inicio/HomeScreen.css'

const INTRO_MS = 1000
const FRAME_MS = 40
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*<>/=+'

const makeGlitchPlan = () => ({
  start: Math.random() * 560,
  length: 180 + Math.random() * 160,
})

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useGlitchClock() {
  const [elapsed, setElapsed] = useState(() => (
    prefersReducedMotion() ? INTRO_MS : 0
  ))

  useEffect(() => {
    if (prefersReducedMotion()) return undefined

    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const time = Math.min(performance.now() - startedAt, INTRO_MS)
      setElapsed(time)

      if (time >= INTRO_MS) {
        window.clearInterval(timer)
      }
    }, FRAME_MS)

    return () => window.clearInterval(timer)
  }, [])

  return elapsed
}

function MatrixText({ text, elapsed, seed = 0 }) {
  const characters = Array.from(text)
  const plans = useMemo(
    () => characters.map(makeGlitchPlan),
    [text]
  )
  const frame = Math.floor(elapsed / FRAME_MS)
  let characterIndex = 0

  return (
    <span className="matrix-text" aria-hidden="true">
      {text.split(/(\s+)/).map((part, partIndex) => {
        if (!part) return null

        const partCharacters = Array.from(part)
        const wordStart = characterIndex
        characterIndex += partCharacters.length

        if (/^\s+$/.test(part)) return part

        return (
          <span className="matrix-word" key={partIndex}>
            {partCharacters.map((character, index) => {
              const charIndex = wordStart + index
              const plan = plans[charIndex]
              let shown = character
              let state = ''
              const style = {}

              if (elapsed < plan.start) {
                state = ' is-hidden'
              } else if (elapsed < plan.start + plan.length) {
                state = ' is-glitch'
                const charSeed = seed + partIndex * 97 + index * 13
                shown = GLYPHS[(charSeed + frame * 17) % GLYPHS.length]
                style['--gx'] = `${((charSeed + frame) % 5) - 2}px`
              }

              return (
                <span
                  className={`matrix-char${state}`}
                  style={style}
                  key={index}
                >
                  {shown}
                </span>
              )
            })}
          </span>
        )
      })}
    </span>
  )
}

function HomeIntro({ onOpenMissions, onOpenPlanning }) {
  const elapsed = useGlitchClock()
  const description = 'Select a point on the Moon or explore the archive of historic missions.'

  return (
    <motion.div
      className="home-intro"
      initial={{ opacity: 0, filter: 'blur(5px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(4px)' }}
      transition={{ duration: 0.22 }}
    >
      <h2 aria-label="One small step. A world to discover.">
        <span className="home-intro-line">
          <MatrixText text="One small step." elapsed={elapsed} seed={0} />
        </span>
        <br />
        <span className="home-intro-line">
          <em>
            <MatrixText text="A world" elapsed={elapsed} seed={17} />
          </em>
          {' '}
          <MatrixText text="to discover." elapsed={elapsed} seed={31} />
        </span>
      </h2>

      <p aria-label={description}>
        <MatrixText text={description} elapsed={elapsed} seed={53} />
      </p>

      <div className="home-actions">
        <button className="menu-option" onClick={onOpenMissions}>
          <span>
            <strong aria-label="Historic missions">
              <MatrixText text="Historic missions" elapsed={elapsed} seed={71} />
            </strong>
          </span>
        </button>

        <button
          className="menu-option option-disabled"
          onClick={onOpenPlanning}
        >
          <span>
            <strong aria-label="Trip planning">
              <MatrixText text="Trip planning" elapsed={elapsed} seed={89} />
            </strong>
          </span>
        </button>

      </div>
    </motion.div>
  )
}

function HomeScreen({
  panelOpen,
  onOpenMissions,
  onOpenPlanning,
}) {
  return (
    <motion.section
      className="home-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="home-vignette" />
      <div className={`home-brand ${panelOpen ? 'is-panel-open' : ''}`} aria-label="Oddity">
        <OddityLogo />
      </div>

      <AnimatePresence>
        {!panelOpen && (
          <HomeIntro
            key="home-intro"
            onOpenMissions={onOpenMissions}
            onOpenPlanning={onOpenPlanning}
          />
        )}
      </AnimatePresence>
    </motion.section>
  )
}

export default HomeScreen
