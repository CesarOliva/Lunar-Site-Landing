import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { missions } from './data/missions.js'
import sceneCatalog from '../data/apollo_scenes.json'
import Moon from './componentes/Luna/Moon.jsx'
import HomeScreen from './componentes/inicio/HomeScreen.jsx'
import IntroScreen from './componentes/inicio/IntroScreen.jsx'
import TransitionScreen from './componentes/inicio/TransitionScreen.jsx'
import MissionList from './componentes/misiones/MissionList.jsx'
import MissionPreview from './componentes/misiones/MissionPreview.jsx'
import TimelineScreen from './componentes/misiones/TimelineScreen.jsx'
import PlanningPanel from './componentes/planificacion/PlanningPanel.jsx'
import PanelActions from './componentes/compartidos/PanelActions.jsx'
import StarField from './componentes/compartidos/StarField.jsx'
import './estilos/compartidos/App.css'

const ROCKET_EXIT_DURATION = 900
const ROCKET_PAUSE_DURATION = 500
const ROCKET_FLIGHT_DURATION = 1000
const ROCKET_OVERTAKE_DURATION = 700
const TRANSITION_DURATION = 2200

function App() {
  const [screen, setScreen] = useState('intro')
  const [panel, setPanel] = useState(null)
  const [selectedMission, setSelectedMission] = useState(null)
  const [activeScene, setActiveScene] = useState(null)
  const [hoveredMission, setHoveredMission] = useState(null)
  const [slide, setSlide] = useState(0)
  const transitionStarted = useRef(false)

  const startExperience = () => {
    if (transitionStarted.current) return

    transitionStarted.current = true
    setScreen('launch')
    window.setTimeout(() => {
      setScreen('launch-pause')
      window.setTimeout(() => {
        setScreen('flight')
        window.setTimeout(() => {
          setScreen('overtake')
          window.setTimeout(() => {
            setScreen('transition')
            window.setTimeout(
              () => setScreen('home'),
              TRANSITION_DURATION - ROCKET_OVERTAKE_DURATION
            )
          }, ROCKET_OVERTAKE_DURATION)
        }, ROCKET_FLIGHT_DURATION)
      }, ROCKET_PAUSE_DURATION)
    }, ROCKET_EXIT_DURATION)
  }

  const showMission = (mission) => {
    setHoveredMission(null)
    setSelectedMission(mission)
    setActiveScene(sceneCatalog.missions[mission.id])
    setSlide(0)
    setPanel('preview')
  }

  const goHome = () => {
    setHoveredMission(null)
    setScreen('home')
    setPanel(null)
    setSelectedMission(null)
    setActiveScene(null)
  }

  const goBack = () => {
    setHoveredMission(null)

    if (screen === 'timeline') {
      setScreen('home')
      setPanel('preview')
      return
    }
    if (panel === 'preview' && screen === 'home') {
      setPanel('list')
      setSelectedMission(null)
      setActiveScene(null)
      return
    }
    setPanel(null)
  }

  const openTimeline = () => {
    setHoveredMission(null)
    setScreen('timeline')
    setPanel(null)
  }

  return (
    <main className={`app-shell screen-${screen}`}>
      <StarField />

      {screen !== 'timeline' && (
        <Moon
          phase={screen}
          missions={screen === 'home' ? missions : []}
          selectedMission={screen === 'home' ? selectedMission : null}
          hoveredMission={screen === 'home' ? hoveredMission : null}
          scene={screen === 'home' ? activeScene : null}
          onShowMission={showMission}
        />
      )}

      <AnimatePresence mode="wait">
        {screen === 'intro' && (
          <IntroScreen key="intro" onStart={startExperience} />
        )}

        {['launch', 'launch-pause', 'flight', 'overtake', 'transition'].includes(screen) && (
          <TransitionScreen key="transition" />
        )}

        {screen === 'home' && (
          <HomeScreen
            key="home"
            panelOpen={Boolean(panel)}
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
              className={`side-panel ${panel === 'preview' ? 'preview-panel' : ''} ${panel === 'planning' ? 'planning-panel-shell' : ''}`}
              key={panel}
              initial={{ x: '-105%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-105%', opacity: 0.6 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <PanelActions onBack={goBack} onHome={goHome} />

              {panel === 'list' && (
                <MissionList
                  missions={missions}
                  onSelect={showMission}
                  onHover={setHoveredMission}
                />
              )}

              {panel === 'preview' && selectedMission && (
                <MissionPreview
                  mission={selectedMission}
                  slide={slide}
                  onSlide={(direction) => setSlide((slide + direction + 3) % 3)}
                  onExplore={openTimeline}
                  onSceneChange={setActiveScene}
                />
              )}

              {panel === 'planning' && (
                <PlanningPanel />
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      )}
    </main>
  )
}

export default App
