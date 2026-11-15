import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from 'lucide-react'
import TimelineShip from './TimelineShip.jsx'
import '../../estilos/misiones/MissionTimeline.css'

const SHIP_OFFSET = 26     // px a la derecha del punto de cada evento (queda sobre/bajo su texto)
const MAX_AMPLITUDE = 110  // px máximos que la nave se separa de la línea
const TURN_SHARE = 0.26    // largo del giro para cruzar la línea, como fracción de la distancia entre eventos
const AUTOPLAY_SEGMENT_MS = 5500
const CHEVRON_ANIMATION_MS = 1000

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Convierte la rueda del mouse (vertical) en desplazamiento horizontal, con inercia suave.
// Los gestos horizontales del trackpad y el swipe táctil siguen funcionando de forma nativa.
function useWheelScroll(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    let target = el.scrollLeft
    let frame = 0

    const animate = () => {
      const diff = target - el.scrollLeft
      if (Math.abs(diff) < 1) {
        el.scrollLeft = target
        frame = 0
        return
      }
      el.scrollLeft += Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.14)
      frame = requestAnimationFrame(animate)
    }

    const onWheel = (event) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()

      const delta = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY
      const max = el.scrollWidth - el.clientWidth
      if (!frame) target = el.scrollLeft
      target = clamp(target + delta, 0, max)

      if (prefersReducedMotion()) {
        el.scrollLeft = target
        return
      }
      if (!frame) frame = requestAnimationFrame(animate)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}

function MissionTimeline({ events }) {
  const scrollerRef = useRef(null)
  const railRef = useRef(null)
  const shipRef = useRef(null)
  const hintRef = useRef(null)
  const eventRefs = useRef([])
  const chevronAnimationRef = useRef(0)
  const geometry = useRef({ stations: [], eventWidth: 0, amplitude: 0 })
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useWheelScroll(scrollerRef)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined

    const stopPlayback = () => {
      setIsPlaying(false)
      if (chevronAnimationRef.current) {
        cancelAnimationFrame(chevronAnimationRef.current)
        chevronAnimationRef.current = 0
      }
    }
    scroller.addEventListener('wheel', stopPlayback, { passive: true })
    scroller.addEventListener('pointerdown', stopPlayback)
    scroller.addEventListener('touchstart', stopPlayback, { passive: true })

    return () => {
      scroller.removeEventListener('wheel', stopPlayback)
      scroller.removeEventListener('pointerdown', stopPlayback)
      scroller.removeEventListener('touchstart', stopPlayback)
    }
  }, [])

  useEffect(() => () => {
    if (chevronAnimationRef.current) {
      cancelAnimationFrame(chevronAnimationRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) return undefined

    const scroller = scrollerRef.current
    const lastIndex = events.length - 1
    if (!scroller || lastIndex < 1) {
      setIsPlaying(false)
      return undefined
    }

    const max = scroller.scrollWidth - scroller.clientWidth
    if (max <= 0) {
      setIsPlaying(false)
      return undefined
    }

    const step = max / lastIndex
    let from = scroller.scrollLeft
    if (from >= max - 1) {
      from = 0
      scroller.scrollLeft = 0
    }

    let targetIndex = Math.min(
      lastIndex,
      Math.floor(from / step + 0.0001) + 1
    )
    let to = targetIndex * step
    let duration = AUTOPLAY_SEGMENT_MS * ((to - from) / step)
    let startedAt = 0
    let frame = 0

    const animate = (timestamp) => {
      if (!startedAt) startedAt = timestamp

      const progress = clamp((timestamp - startedAt) / duration, 0, 1)
      const eased = progress * progress * (3 - 2 * progress)
      scroller.scrollLeft = from + (to - from) * eased

      if (progress === 1) {
        if (targetIndex >= lastIndex) {
          setIsPlaying(false)
          return
        }

        from = to
        targetIndex += 1
        to = targetIndex * step
        duration = AUTOPLAY_SEGMENT_MS
        startedAt = timestamp
      }

      frame = window.requestAnimationFrame(animate)
    }

    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [events.length, isPlaying])

  const moveToAdjacentEvent = (direction) => {
    const scroller = scrollerRef.current
    if (!scroller || events.length < 2) return

    setIsPlaying(false)
    const max = scroller.scrollWidth - scroller.clientWidth
    const progress = max > 0 ? clamp(scroller.scrollLeft / max, 0, 1) : 0
    const current = Math.round(progress * (events.length - 1))
    const targetIndex = clamp(current + direction, 0, events.length - 1)

    const start = scroller.scrollLeft
    const target = (max * targetIndex) / (events.length - 1)

    if (prefersReducedMotion() || Math.abs(target - start) < 1) {
      scroller.scrollLeft = target
      return
    }

    if (chevronAnimationRef.current) {
      cancelAnimationFrame(chevronAnimationRef.current)
    }

    let startedAt
    const animate = (timestamp) => {
      if (startedAt === undefined) startedAt = timestamp

      const progress = clamp(
        (timestamp - startedAt) / CHEVRON_ANIMATION_MS,
        0,
        1
      )
      const eased = progress * progress * (3 - 2 * progress)
      scroller.scrollLeft = start + (target - start) * eased

      if (progress < 1) {
        chevronAnimationRef.current = window.requestAnimationFrame(animate)
      } else {
        scroller.scrollLeft = target
        chevronAnimationRef.current = 0
      }
    }

    chevronAnimationRef.current = window.requestAnimationFrame(animate)
  }

  // La posición de la nave depende solo del scroll:
  // progreso 0 → primer evento, progreso 1 → último evento.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const rail = railRef.current
    const ship = shipRef.current
    const hint = hintRef.current

    const update = () => {
      const { stations, eventWidth, amplitude } = geometry.current
      if (stations.length < 2) return

      const max = scroller.scrollWidth - scroller.clientWidth
      const progress = max > 0 ? clamp(scroller.scrollLeft / max, 0, 1) : 0

      // s = índice continuo del evento (0, 1, 2, 3 ... con decimales entre uno y otro)
      const s = progress * (stations.length - 1)
      const currentIndex = Math.min(
        stations.length - 1,
        Math.floor(s + 0.5)
      )
      setActiveIndex((current) => (
        current === currentIndex ? current : currentIndex
      ))
      const i = Math.min(Math.floor(s), stations.length - 2)
      const span = stations[i + 1] - stations[i]
      const travel = (s - i) * span // px recorridos desde el evento i

      // Trayectoria entre el evento i y el i+1:
      // 1) la nave va recta junto a su evento, del lado contrario al texto;
      // 2) cruza la línea justo a mitad del hueco entre un texto y el siguiente,
      //    así nunca pasa por encima de ninguno, sin importar qué tan grande sea el texto;
      // 3) llega recta al lado contrario del siguiente evento.
      const crossAt = (eventWidth + span) / 2 - SHIP_OFFSET
      const half = Math.max(1, Math.min(span * TURN_SHARE, span - crossAt, crossAt)) // mitad del giro
      const u = clamp((travel - (crossAt - half)) / (2 * half), 0, 1)
      const ease = u * u * (3 - 2 * u)

      const side = i % 2 === 0 ? 1 : -1 // +1 = abajo de la línea, -1 = arriba
      const x = stations[i] + SHIP_OFFSET + travel
      const y = side * amplitude * (1 - 2 * ease)

      // Se inclina según la pendiente del giro y va recta el resto del tiempo
      const slope = (-side * 6 * amplitude * u * (1 - u)) / half
      const bank = (Math.atan(slope) * 180) / Math.PI

      // La nave 3D se ve de perfil con la nariz a la derecha: con bank = 0 va recta, sin ángulo base que sumar
      ship.style.transform = `translate(${x}px, ${y}px) rotate(${bank}deg)`
      hint.style.opacity = String(Math.max(0, 1 - progress * 10))
    }

    // Lee del DOM dónde quedó realmente cada evento (así sigue bien aunque cambie el CSS o el tamaño de pantalla)
    const measure = () => {
      const nodes = eventRefs.current.filter(Boolean)
      geometry.current = {
        stations: nodes.map((el) => el.offsetLeft),
        eventWidth: Math.max(0, ...nodes.map((el) => el.offsetWidth)),
        amplitude: Math.min(MAX_AMPLITUDE, scroller.clientHeight * 0.14),
      }
      update()
    }

    measure()
    scroller.addEventListener('scroll', update, { passive: true })
    // Se vuelve a medir si cambia la ventana o el ancho del riel (por ejemplo, al editar --step en el CSS)
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    observer.observe(rail)

    return () => {
      scroller.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [events])

  return (
    <div className="timeline-stage">
      <div className="timeline-scroller" ref={scrollerRef} tabIndex={0} role="region" aria-label="Línea de tiempo de la misión">
        <div className="timeline-rail" ref={railRef} style={{ '--count': events.length }}>
          <span className="timeline-line" />

          {events.map((event, index) => (
            <motion.article
              className={`timeline-event ${index % 2 === 0 ? 'is-above' : 'is-below'} ${activeIndex === index ? 'is-current' : 'is-muted'}`}
              style={{ '--i': index }}
              key={event.time}
              ref={(el) => { eventRefs.current[index] = el }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: activeIndex === index ? 1 : 0.3, y: 0 }}
              transition={{
                opacity: { duration: 0.24 },
                y: { duration: 0.4, delay: index * 0.12 },
              }}
            >
              <span className="timeline-point" />
              <small>{event.time}</small>
              <h3>{event.title}</h3>
              <p>{event.detail}</p>
              <img
                className="timeline-event-image"
                src={event.image.src}
                alt={event.image.alt}
                loading="lazy"
                decoding="async"
              />
            </motion.article>
          ))}

          <motion.div
            className="timeline-ship-anchor"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <div className="timeline-ship" ref={shipRef}>
              <TimelineShip />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="timeline-footer">
        <span className="timeline-hint" ref={hintRef} aria-hidden="true">
          DESLIZA <ArrowRight size={13} />
        </span>
        <div className="timeline-controls" role="group" aria-label="Controles de la línea del tiempo">
          <button
            className="timeline-control"
            type="button"
            aria-label="Evento anterior"
            disabled={activeIndex === 0}
            onClick={() => moveToAdjacentEvent(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="timeline-control"
            type="button"
            aria-label={isPlaying ? 'Pausar recorrido' : 'Reproducir recorrido'}
            aria-pressed={isPlaying}
            onClick={() => setIsPlaying((playing) => !playing)}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            className="timeline-control"
            type="button"
            aria-label="Evento siguiente"
            disabled={activeIndex === events.length - 1}
            onClick={() => moveToAdjacentEvent(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default MissionTimeline