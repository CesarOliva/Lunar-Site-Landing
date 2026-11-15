import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './estilos/styles.css'
import { preloadHighQualityMoon } from '../moon/src/integracion/highQualityMoon.js'

// Las 256 teselas de la luna de calidad alta se descargan mientras el usuario ve la introducción.
preloadHighQualityMoon()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
