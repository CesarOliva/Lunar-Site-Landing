import { useEffect, useMemo, useState } from 'react'

const MATRIX_TITLE_DURATION = 1000
const MATRIX_TITLE_FRAME = 40
const MATRIX_TITLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*<>/=+'

function MatrixTitleText({ text }) {
  const [elapsed, setElapsed] = useState(() => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? MATRIX_TITLE_DURATION
      : 0
  ))
  const plans = useMemo(
    () => Array.from(text, () => ({
      start: Math.random() * 600,
      length: 200 + Math.random() * 200,
    })),
    [text]
  )

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const time = Math.min(performance.now() - startedAt, MATRIX_TITLE_DURATION)
      setElapsed(time)
      if (time >= MATRIX_TITLE_DURATION) window.clearInterval(timer)
    }, MATRIX_TITLE_FRAME)

    return () => window.clearInterval(timer)
  }, [])

  const frame = Math.floor(elapsed / MATRIX_TITLE_FRAME)

  return (
    <span className="planning-matrix-title" aria-hidden="true">
      {Array.from(text, (character, index) => {
        const plan = plans[index]
        let shown = character
        let className = 'planning-matrix-char'

        if (character !== ' ' && elapsed < plan.start) {
          className += ' is-hidden'
        } else if (character !== ' ' && elapsed < plan.start + plan.length) {
          className += ' is-glitch'
          shown = MATRIX_TITLE_GLYPHS[(index * 17 + frame * 13) % MATRIX_TITLE_GLYPHS.length]
        }

        return <span className={className} key={`${index}-${character}`}>{shown}</span>
      })}
    </span>
  )
}

export default function MatrixHeading({ id, text, emphasis }) {
  return (
    <h2 id={id} aria-label={`${text} ${emphasis}`}>
      <MatrixTitleText text={text} />{' '}
      <em><MatrixTitleText text={emphasis} /></em>
    </h2>
  )
}
