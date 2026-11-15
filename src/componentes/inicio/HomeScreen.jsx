
import { motion } from 'framer-motion'

import { ArrowRight } from 'lucide-react'

import Moon from '../Luna/Moon'

import '../../estilos/inicio/HomeScreen.css'

function HomeScreen({
  missions,
  selectedMission,
  onShowMission,
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

      {/* Escena lunar 3D */}
      <Moon
        missions={missions}
        selectedMission={selectedMission}
        onShowMission={onShowMission}
      />

      {/* Superposición visual */}
      <div className="home-vignette" />

      {/* Introducción */}
      <div className="home-intro">

        <h2>
          Un pequeño paso.
          <br />
          <em>Un mundo</em> por descubrir.
        </h2>

        <p>
          Selecciona un punto en la Luna o explora
          el archivo de misiones históricas.
        </p>

        <div className="home-actions">

          <button
            className="menu-option"
            onClick={onOpenMissions}
          >
            <span>
              <strong>Misiones históricas</strong>
            </span>

            <ArrowRight
              size={16}
              className="option-arrow"
            />
          </button>

          <button
            className="menu-option option-disabled"
            onClick={onOpenPlanning}
          >
            <span>
              <strong>Planeación de viaje</strong>
            </span>

            <ArrowRight
              size={16}
              className="option-arrow"
            />
          </button>

        </div>
      </div>

    </motion.section>
  )
}

export default HomeScreen
