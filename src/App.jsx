import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Home,
  List,
  Orbit,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react'
import { missions } from './data/missions.js'

function App() {
  const [screen, setScreen] = useState('intro')
  const [panel, setPanel] = useState(null)
  const [selectedMission, setSelectedMission] = useState(null)
  const [slide, setSlide] = useState(0)

  const startExperience = () => {
    setScreen('transition')
    window.setTimeout(() => setScreen('home'), 1450)
  }

  const showMission = (mission) => {
    setSelectedMission(mission)
    setSlide(0)
    setPanel('preview')
  }

  const goHome = () => {
    setScreen('home')
    setPanel(null)
    setSelectedMission(null)
  }

  const goBack = () => {
    if (screen === 'timeline') {
      setScreen('home')
      setPanel('preview')
      return
    }
    if (panel === 'preview' && screen === 'home') {
      setPanel('list')
      setSelectedMission(null)
      return
    }
    setPanel(null)
  }

  const openTimeline = () => {
    setScreen('timeline')
    setPanel(null)
  }

  return (
    <main className={`app-shell screen-${screen}`}>
      <div className="star-field" aria-hidden="true" />
      <div className="ambient-glow" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {screen === 'intro' && (
          <motion.section
            className="intro-screen"
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="intro-copy">
              <span className="eyebrow"><span className="live-dot" /> NASA SPACE APPS CHALLENGE 2026</span>
              <h1>La próxima<br /><em>frontera</em> lunar.</h1>
              <p>
                Explora las misiones que nos trajeron hasta aquí. Imagina los sitios
                donde volveremos a pisar la Luna.
              </p>
              <button className="primary-button launch-button" onClick={startExperience}>
                Iniciar exploración <ArrowUpRight size={17} />
              </button>
              <div className="intro-footnote"><span>01</span> UN VIAJE A TRAVÉS DE LA HISTORIA Y EL FUTURO</div>
            </div>
            <motion.div
              className="intro-moon"
              initial={{ scale: 0.9, x: 65 }}
              animate={{ scale: 1, x: 0 }}
              transition={{ duration: 1.8, ease: [0.2, 0.7, 0.2, 1] }}
            />
            <motion.div
              className="spacecraft"
              initial={{ x: 0, y: 0, rotate: -9 }}
              animate={{ x: [0, 7, 0], y: [0, -8, 0], rotate: [-9, -6, -9] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Rocket size={56} strokeWidth={0.9} />
              <span className="craft-glow" />
            </motion.div>
            <div className="intro-coordinate">29° 58′ 31″ N<br />31° 07′ 52″ E</div>
            <div className="scroll-cue"><span>DESCUBRIR</span><ArrowDown size={14} /></div>
          </motion.section>
        )}

        {screen === 'transition' && (
          <motion.section className="transition-screen" key="transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div
              className="transition-moon"
              initial={{ scale: 0.65, x: '13vw', y: '8vh' }}
              animate={{ scale: 2.4, x: '2vw', y: '0vh' }}
              transition={{ duration: 1.45, ease: [0.7, 0, 0.3, 1] }}
            />
            <motion.div
              className="transition-ship"
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: '48vw', y: '-32vh', opacity: 0 }}
              transition={{ duration: 1.1, ease: [0.5, 0, 0.8, 0.4] }}
            ><Rocket size={50} /></motion.div>
            <span className="transition-label">ACERCÁNDONOS A LA LUNA</span>
          </motion.section>
        )}

        {screen === 'home' && (
          <motion.section className="home-screen" key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="home-moon">
              <div className="moon-shadow" />
              <div className="moon-craters" />
              <div className="moon-atmosphere" />
              {missions.map((mission) => (
                <button
                  className={`mission-marker ${selectedMission?.id === mission.id ? 'is-selected' : ''}`}
                  key={mission.id}
                  style={mission.position}
                  aria-label={`Explorar ${mission.name}`}
                  onClick={() => showMission(mission)}
                >
                  <span className="marker-pulse" />
                  <span className="marker-label">{mission.number} / {mission.name}</span>
                </button>
              ))}
            </div>
            <div className="home-vignette" />

            <div className="home-intro">
              <span className="eyebrow"><span className="live-dot" /> EXPLORACIÓN LUNAR</span>
              <h2>Un pequeño paso.<br /><em>Un mundo</em> por descubrir.</h2>
              <p>Selecciona un punto en la Luna o explora el archivo de misiones históricas.</p>
              <div className="home-actions">
                <button className="menu-option" onClick={() => setPanel('list')}>
                  <span className="option-icon"><Orbit size={19} /></span>
                  <span><strong>Misiones históricas</strong><small>Revive la exploración lunar</small></span>
                  <ArrowRight size={16} className="option-arrow" />
                </button>
                <button className="menu-option option-disabled" onClick={() => setPanel('planning')}>
                  <span className="option-icon"><Compass size={19} /></span>
                  <span><strong>Planeación de viaje</strong><small>Próximamente · elige un sitio de aterrizaje</small></span>
                  <ArrowRight size={16} className="option-arrow" />
                </button>
              </div>
            </div>

            <div className="home-caption"><span className="caption-line" /> POLO SUR LUNAR <span>89° S</span></div>
            <div className="home-index"><span>01</span><i /> 03</div>
            <div className="home-bottom-note">UNA NUEVA PERSPECTIVA<br />DE NUESTRO VECINO CELESTE</div>
          </motion.section>
        )}

        {screen === 'timeline' && selectedMission && (
          <motion.section className="timeline-screen" key="timeline" initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }}>
            <div className="timeline-moon" />
            <div className="timeline-topline">
              <button className="icon-button" onClick={goBack} aria-label="Regresar"><ArrowLeft size={18} /></button>
              <span>ARCHIVO DE MISIONES <i /> {selectedMission.number} / 06</span>
              <button className="icon-button" onClick={goHome} aria-label="Ir al inicio"><Home size={17} /></button>
            </div>
            <div className="timeline-content">
              <span className="eyebrow"><span className="live-dot" /> REGISTRO DE MISIÓN · {selectedMission.landingDate.toUpperCase()}</span>
              <h1>{selectedMission.name}<br /><em>Expedición lunar</em></h1>
              <p className="timeline-lead">{selectedMission.purpose}</p>
              <div className="timeline-meta">
                <span><small>SITIO DE ALUNIZAJE</small>{selectedMission.site}</span>
                <span><small>VEHÍCULO</small>{selectedMission.vehicle}</span>
              </div>
              <div className="timeline-track">
                {selectedMission.timeline.map((event, index) => (
                  <motion.article className="timeline-event" key={event.time} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.12 }}>
                    <span className="timeline-point" />
                    <small>{event.time}</small>
                    <h3>{event.title}</h3>
                    <p>{event.detail}</p>
                  </motion.article>
                ))}
              </div>
              <button className="text-button" onClick={goBack}><ArrowLeft size={15} /> Volver a la misión</button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {screen === 'home' && (
        <AnimatePresence>
          {panel && (
            <motion.aside
              className={`side-panel ${panel === 'preview' ? 'preview-panel' : ''}`}
              key={panel}
              initial={{ x: '-105%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-105%', opacity: 0.6 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="panel-top-actions">
                <button className="text-button" onClick={goBack}><ArrowLeft size={15} /> Regresar</button>
                <button className="icon-button" onClick={goHome} aria-label="Regresar al inicio"><Home size={16} /></button>
                <button className="icon-button" onClick={() => setPanel(null)} aria-label="Cerrar panel"><X size={16} /></button>
              </div>

              {panel === 'list' && (
                <div className="mission-list-content">
                  <span className="eyebrow">EL ARCHIVO · 1969 — 1972</span>
                  <h2>Misiones<br /><em>históricas</em></h2>
                  <p className="panel-description">Seis expediciones Apollo que hicieron historia en la superficie lunar.</p>
                  <div className="mission-list">
                    {missions.map((mission) => (
                      <button className="mission-list-item" key={mission.id} onClick={() => showMission(mission)}>
                        <span className="mission-thumb" style={{ '--mission-accent': mission.accent }}><span>{mission.number}</span></span>
                        <span className="mission-list-copy"><small>APOLLO · {mission.landingDate.split(',')[0].toUpperCase()}</small><strong>{mission.name}</strong><em>{mission.site}</em></span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                  <div className="panel-footnote"><Sparkles size={13} /> DATOS DE LAS MISIONES APOLLO DE LA NASA</div>
                </div>
              )}

              {panel === 'preview' && selectedMission && (
                <MissionPreview
                  mission={selectedMission}
                  slide={slide}
                  onSlide={(direction) => setSlide((slide + direction + 3) % 3)}
                  onExplore={openTimeline}
                />
              )}

              {panel === 'planning' && (
                <div className="planning-placeholder">
                  <span className="eyebrow">SIGUIENTE FASE</span>
                  <h2>Planeación<br /><em>de viaje</em></h2>
                  <p>Estamos preparando herramientas para comparar sitios de aterrizaje, iluminación y ventanas de comunicación.</p>
                  <div className="placeholder-card"><Compass size={21} /><span><strong>Explorador del polo sur</strong><small>La experiencia de planeación llegará pronto.</small></span></div>
                  <button className="text-button" onClick={goHome}><ArrowLeft size={15} /> Volver al inicio</button>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      )}
    </main>
  )
}

function MissionPreview({ mission, slide, onSlide, onExplore }) {
  return (
    <div className="preview-content">
      <div className="preview-hero" style={{ '--mission-accent': mission.accent }}>
        <AnimatePresence mode="wait">
          <motion.div
            className={`preview-image preview-image-${slide}`}
            key={`${mission.id}-${slide}`}
            style={{ backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(5,7,13,.78)), url("${mission.image}")` }}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        </AnimatePresence>
        <span className="hero-tag"><span className="live-dot" /> {mission.site.toUpperCase()}</span>
        <div className="hero-controls">
          <span>0{slide + 1} <i /> 03</span>
          <button onClick={() => onSlide(-1)} aria-label="Imagen anterior"><ChevronLeft size={17} /></button>
          <button onClick={() => onSlide(1)} aria-label="Imagen siguiente"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="preview-details">
        <span className="mission-kicker">MISIÓN {mission.number} <i /> ARCHIVO NASA</span>
        <h2>{mission.name}</h2>
        <p className="mission-dates"><span>FECHAS DE MISIÓN</span>{mission.dates}</p>

        <section className="detail-section">
          <span className="section-label">TRIPULACIÓN <i /></span>
          <div className="crew-list">
            {mission.crew.map((person, index) => (
              <div className="crew-member" key={person.name}>
                <span className="crew-number">0{index + 1}</span>
                <span><strong>{person.name}</strong><small>{person.role}</small></span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section purpose-section">
          <span className="section-label">PROPÓSITO DE LA MISIÓN <i /></span>
          <p>{mission.purpose}</p>
          <p className="mission-description">{mission.description}</p>
        </section>

        <button className="primary-button explore-button" onClick={onExplore}>
          Explorar misión <ArrowUpRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default App
