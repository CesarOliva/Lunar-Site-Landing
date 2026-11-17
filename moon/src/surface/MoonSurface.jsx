import { useEffect, useRef } from 'react'
import {
  Color,
  Ellipsoid,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './cesium-host.css'
import { findImageryLayersForPoint, MOON_MEAN_RADIUS_KM } from '../moonTiles.js'
import { loadLolaWindowCached } from '../lolaDem.js'
import {
  createLolaTerrainProvider,
  sampleLolaHeight,
  terrainHeight,
  tileSpacingMeters,
} from './lolaTerrain.js'
import { createMicroRelief, measureRoughness } from './microRelief.js'
import {
  DetailImageryProvider,
  detailTileCache,
  enhancedTileCache,
  estimateSunDirection,
  measureMeanBrightness,
} from './detailImagery.js'
import { FirstPersonController } from './firstPerson.js'
import { createLandingDemo } from './landingDemo.js'
import { createStarSky } from './starSky.js'
import { buildLayerStack, createUrlProvider, imageTileCache } from './imageryStack.js'
import { LOLA_WINDOW_RADIUS_KM } from './config.js'

// Toda la escena de superficie usa el elipsoide lunar (radio medio 1737,4 km).
Ellipsoid.default = Ellipsoid.MOON

const RECENTER_FRACTION = 0.55
const MAX_RELIEF_LEVEL = 15
const WRAP_MIN_METERS = 1.5
const TARGET_BRIGHTNESS = 0.4
const MAX_BRIGHTNESS_BOOST = 3
const NAC_CONTRAST_FACTOR = 0.5 // los mosaicos NAC (<1,5 m/px) ya son muy contrastados
const DEFAULT_CONTRAST = 1.6 // contraste de la imagen (GPU, en vivo); el realce local va aparte
const GLOBE_TILE_CACHE_SIZE = 400 // teselas del globo en memoria (por defecto 100): volver atrás no recarga

function metersBetween(latA, lonA, latB, lonB) {
  const toRadians = Math.PI / 180
  const dLat = (latB - latA) * toRadians
  const dLon = (lonB - lonA) * toRadians * Math.cos(((latA + latB) / 2) * toRadians)
  return Math.hypot(dLat, dLon) * MOON_MEAN_RADIUS_KM * 1000
}

/**
 * Vista de primera persona sobre la Luna con CesiumJS:
 *  - imagen: mosaicos WMTS de NASA Trek (los de mayor resolución que cubren el punto);
 *  - terreno: LOLA 1024 ppd (16 bits, PDS) en una ventana local que se recentra al caminar;
 *  - detalle (opcional): microrrelieve y textura por debajo de la resolución de los datos,
 *    calibrados con la rugosidad real de LOLA de la zona y el sol estimado de la imagen.
 * Catálogo, ventanas LOLA, teselas de imagen y teselas con detalle se guardan en cachés de sesión.
 */
function MoonSurface({
  point,
  exaggeration,
  apiRef,
  onStatus,
  onReady,
  onError,
  onTourActiveChange,
  onPositionChange,
  landingModelUrl,
  onDemoChange,
}) {
  const hostRef = useRef(null)
  const exaggerationRef = useRef(exaggeration)
  // El visor depende de las coordenadas, no de la identidad del objeto `point`: quien lo use puede
  // crear un objeto nuevo en cada render sin que se destruya y recree el visor.
  const pointLatitude = point?.latitude
  const pointLongitude = point?.longitude

  useEffect(() => {
    exaggerationRef.current = exaggeration
    apiRef.current?.setVerticalExaggeration(exaggeration)
  }, [exaggeration, apiRef])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !Number.isFinite(pointLatitude) || !Number.isFinite(pointLongitude)) return undefined
    const point = { latitude: pointLatitude, longitude: pointLongitude }

    const abort = new AbortController()
    let viewer
    let controller
    let landingDemo
    let starSky
    let lolaWindow
    let recentering = false
    let disposed = false
    let handleEscape
    let layers = []
    let roughness = 1
    let detail = 1
    let baseId
    let relief = null
    let sun = null
    let sunFor = null
    let rebuildToken = 0
    let contrast = DEFAULT_CONTRAST
    let currentLayers = []
    let currentStack = []

    const applyContrast = () => {
      currentLayers.forEach((imageryLayer, index) => {
        const isNac = currentStack[index].resolutionMetersPerPixel <= WRAP_MIN_METERS
        imageryLayer.contrast = isNac ? 1 + (contrast - 1) * NAC_CONTRAST_FACTOR : contrast
      })
    }

    const groundHeight = (latitude, longitude) => terrainHeight(
      lolaWindow,
      relief,
      (latitude * 180) / Math.PI,
      (longitude * 180) / Math.PI,
      tileSpacingMeters(MAX_RELIEF_LEVEL),
    )

    /**
     * (Re)construye capas de imagen y terreno con el nivel de detalle y la imagen base actuales.
     * Las capas se añaden de inmediato: la imagen base se ve mientras se estima el sol, que solo
     * retrasa los niveles con detalle. Devuelve la promesa `sunReady` para actualizar el HUD.
     */
    const rebuild = () => {
      rebuildToken += 1
      const token = rebuildToken
      const { scene } = viewer
      relief = detail > 0
        ? createMicroRelief({ roughness, referenceLatitude: point.latitude, strength: detail })
        : null

      const { stack, base, candidates } = buildLayerStack(layers, baseId)
      const providers = stack.map((layer) => createUrlProvider(layer))
      const baseIndex = stack.indexOf(base)

      // El sol y el brillo medio se estiman una vez por imagen base (con su propia tesela y LOLA).
      const needsSun = base && sunFor !== base.id && base.resolutionMetersPerPixel > WRAP_MIN_METERS
      const sunReady = needsSun
        ? estimateSunDirection(providers[baseIndex], lolaWindow, point.latitude, point.longitude)
          .then((estimate) => {
            if (token !== rebuildToken) return
            sun = estimate
            sunFor = base.id
          })
        : Promise.resolve()

      const signature = (layer) => {
        const sunKey = sun ? `${Math.round((sun.azimuth * 180) / Math.PI)}/${Math.round((sun.elevation * 180) / Math.PI)}` : 'x'
        return `${layer.id}|d${detail}|r${roughness.toFixed(3)}|${point.latitude.toFixed(4)}|${sunKey}`
      }
      // Todas las capas reciben el realce de contraste local; el microrrelieve sintético solo se añade a las
      // de baja resolución (las NAC de ~0,3-1 m ya traen ese detalle real).
      const wrapped = providers.map((provider, index) => new DetailImageryProvider(provider, {
        cacheId: stack[index].id,
        relief: stack[index].resolutionMetersPerPixel > WRAP_MIN_METERS ? relief : null,
        getStrength: () => detail,
        getSun: () => sun,
        sunReady,
        getSignature: () => signature(stack[index]),
      }))

      viewer.imageryLayers.removeAll()
      const imageryLayers = wrapped.map((provider) => {
        const imageryLayer = new ImageryLayer(provider)
        viewer.imageryLayers.add(imageryLayer)
        return imageryLayer
      })
      currentLayers = imageryLayers
      currentStack = stack
      applyContrast()
      // Cada capa se normaliza hacia un brillo medio de ~0,4 antes del contraste (que gira en torno a 0,5:
      // sin esto, los mosaicos oscuros —globales y NAC, con brillo medio ~0,15— quedarían negros).
      providers.forEach((provider, index) => {
        measureMeanBrightness(provider, point.latitude, point.longitude).then((mean) => {
          if (token !== rebuildToken || viewer.isDestroyed() || !mean) return
          imageryLayers[index].brightness = Math.min(
            MAX_BRIGHTNESS_BOOST,
            Math.max(1, TARGET_BRIGHTNESS / mean),
          )
        })
      })

      scene.terrainProvider = createLolaTerrainProvider(lolaWindow, relief)
      controller?.apply()
      return { stack, base, candidates, sunReady }
    }

    const start = async () => {
      try {
        onStatus({ phase: 'catalog' })

        // El visor (WebGL) se crea mientras se descargan los datos, no después.
        viewer = new Viewer(host, {
          baseLayer: false,
          terrainProvider: new EllipsoidTerrainProvider({ ellipsoid: Ellipsoid.MOON }),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          skyAtmosphere: false,
        })
        if (import.meta.env.DEV) {
          window.__moonViewer = viewer // solo desarrollo: capturas y mediciones de prueba
          window.__moonCaches = { imageTileCache, detailTileCache, enhancedTileCache }
        }
        const { scene } = viewer
        scene.globe.baseColor = Color.fromCssColorString('#2a2a2a')
        scene.globe.enableLighting = false // la imagen ya contiene la iluminación solar real
        scene.globe.showGroundAtmosphere = false
        scene.globe.depthTestAgainstTerrain = true
        scene.globe.maximumScreenSpaceError = 1.25
        scene.globe.tileCacheSize = GLOBE_TILE_CACHE_SIZE
        scene.backgroundColor = Color.BLACK
        scene.fog.enabled = false
        if (scene.sun) scene.sun.show = false
        if (scene.moon) scene.moon.show = false
        scene.screenSpaceCameraController.enableInputs = false
        scene.verticalExaggeration = exaggerationRef.current
        // Cesium solo crea su cielo estrellado con el elipsoide terrestre: aquí se dibuja uno real propio.
        starSky = createStarSky(viewer)
        viewer.camera.frustum.fov = (70 * Math.PI) / 180

        const [foundLayers, firstWindow] = await Promise.all([
          findImageryLayersForPoint(point.latitude, point.longitude, abort.signal),
          loadLolaWindowCached(
            point.latitude,
            point.longitude,
            LOLA_WINDOW_RADIUS_KM,
            abort.signal,
            (progress) => onStatus({ phase: 'terrain', terrain: progress }),
          ),
        ])
        if (disposed) return
        layers = foundLayers
        lolaWindow = firstWindow
        roughness = measureRoughness(
          (latitude, longitude) => sampleLolaHeight(lolaWindow, latitude, longitude),
          point.latitude,
          point.longitude,
        )
        onStatus({ phase: 'scene' })

        controller = new FirstPersonController(viewer, { getGroundHeight: groundHeight })
        if (import.meta.env.DEV) window.__moonController = controller // solo desarrollo
        // La exageración se aplica respecto a la altura de salida: al cambiarla no se mueve el suelo bajo los pies.
        scene.verticalExaggerationRelativeHeight = sampleLolaHeight(
          lolaWindow, point.latitude, point.longitude,
        )
        const built = rebuild()
        controller.teleport(point.latitude, point.longitude)

        controller.onMove = (latitude, longitude) => {
          onPositionChange?.({ latitude, longitude })
          if (recentering) return
          const { center, radiusKm } = lolaWindow
          if (metersBetween(center.latitude, center.longitude, latitude, longitude)
            < radiusKm * 1000 * RECENTER_FRACTION) return
          recentering = true
          loadLolaWindowCached(latitude, longitude, LOLA_WINDOW_RADIUS_KM, abort.signal)
            .then((nextWindow) => {
              if (disposed) return
              lolaWindow = nextWindow
              scene.terrainProvider = createLolaTerrainProvider(nextWindow, relief)
            })
            .catch((error) => { if (error.name !== 'AbortError') onError(error.message) })
            .finally(() => { recentering = false })
        }

        const describe = (result) => ({
          imagery: result.stack.map((layer) => ({
            id: layer.id,
            title: layer.title,
            resolutionMetersPerPixel: layer.resolutionMetersPerPixel,
            maximumLevel: layer.maximumLevel,
          })),
          baseId: result.base?.id,
          baseOptions: result.candidates.map((layer) => ({
            id: layer.id,
            title: layer.title,
            resolutionMetersPerPixel: layer.resolutionMetersPerPixel,
          })),
          dem: {
            title: 'LRO LOLA LDEM 1024 ppd (PDS, 16 bits)',
            resolutionMetersPerPixel: lolaWindow.metersPerPixel,
          },
          detail: {
            roughness,
            sun: sun ? {
              azimuthDegrees: ((sun.azimuth * 180) / Math.PI + 360) % 360,
              elevationDegrees: (sun.elevation * 180) / Math.PI,
              estimated: sun.estimated,
            } : null,
          },
        })
        const publish = (result) => {
          onReady(describe(result))
          // El HUD se actualiza de nuevo cuando termina la estimación del sol.
          result.sunReady.then(() => { if (!disposed) onReady(describe(result)) })
        }

        // Demostración de aterrizaje (solo si la aplicación aporta el modelo de la nave).
        if (landingModelUrl) {
          landingDemo = createLandingDemo({
            viewer,
            controller,
            modelUrl: landingModelUrl,
            fallbackGroundHeight: groundHeight,
            getSun: () => sun,
            onChange: (demoState) => onDemoChange?.(demoState),
          })
        }

        apiRef.current = {
          setSkyTimeScale: (value) => starSky?.setTimeScale(value),
          startLandingDemo: () => landingDemo?.start().catch((error) => console.error('Landing demo:', error)),
          stopLandingDemo: () => landingDemo?.stop(),
          setVerticalExaggeration: (value) => {
            if (!viewer.isDestroyed()) scene.verticalExaggeration = value
          },
          setTourActive: (active) => {
            controller.setActive(active)
            onTourActiveChange(active)
          },
          setWalkingDirection: (direction, isMoving) => controller.setWalking(direction, isMoving),
          setContrast: (value) => {
            contrast = value
            applyContrast()
          },
          setDetail: (value) => {
            detail = value
            publish(rebuild())
          },
          setBaseImagery: (id) => {
            baseId = id
            publish(rebuild())
          },
        }
        handleEscape = (event) => {
          if (event.key === 'Escape' && controller.active) apiRef.current?.setTourActive(false)
        }
        window.addEventListener('keydown', handleEscape)

        publish(built)
      } catch (error) {
        if (error.name !== 'AbortError' && !disposed) onError(error.message)
      }
    }
    start()

    return () => {
      disposed = true
      abort.abort()
      if (handleEscape) window.removeEventListener('keydown', handleEscape)
      if (viewer && !viewer.isDestroyed()) {
        landingDemo?.stop()
        starSky?.dispose()
        controller?.dispose()
        viewer.destroy()
      }
      apiRef.current = null
    }
  }, [pointLatitude, pointLongitude, apiRef, onStatus, onReady, onError, onTourActiveChange, onPositionChange, landingModelUrl, onDemoChange])

  return <div className="cesium-host" ref={hostRef} />
}

export default MoonSurface
