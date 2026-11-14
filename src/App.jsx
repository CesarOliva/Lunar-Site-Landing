import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { missions } from './data/missions.js'
import HomeScreen from './componentes/inicio/HomeScreen.jsx'
import IntroScreen from './componentes/inicio/IntroScreen.jsx'
import TransitionScreen from './componentes/inicio/TransitionScreen.jsx'
import MissionList from './componentes/misiones/MissionList.jsx'
import MissionPreview from './componentes/misiones/MissionPreview.jsx'
import TimelineScreen from './componentes/misiones/TimelineScreen.jsx'
import PlanningPanel from './componentes/planificacion/PlanningPanel.jsx'
import PanelActions from './componentes/compartidos/PanelActions.jsx'

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
          <IntroScreen key="intro" onStart={startExperience} />
        )}

        {screen === 'transition' && (
          <TransitionScreen key="transition" />
        )}

        {screen === 'home' && (
          <HomeScreen
            key="home"
            missions={missions}
            selectedMission={selectedMission}
            onShowMission={showMission}
            onOpenMissions={() => setPanel('list')}
            onOpenPlanning={() => setPanel('planning')}
          />
        )}

        {screen === 'timeline' && selectedMission && (
          <TimelineScreen mission={selectedMission} onBack={goBack} onHome={goHome} />
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
              <PanelActions onBack={goBack} onHome={goHome} onClose={() => setPanel(null)} />

              {panel === 'list' && (
                <MissionList missions={missions} onSelect={showMission} />
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
                <PlanningPanel onHome={goHome} />
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      )}
    </main>
  )
}

export default App
