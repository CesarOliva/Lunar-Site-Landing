import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ConeEmitter,
  DirectionalLight,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Model,
  ParticleSystem,
  Transforms,
} from 'cesium'

// ---- Parámetros de la demostración ------------------------------------------------------------
const MODEL_NATIVE_HEIGHT = 13 // unidades del modelo Saturn V.glb de la base a la punta (medido)
const SHIP_HEIGHT_METERS = 45 // altura con la que se muestra
const DISTANCE_AHEAD_METERS = 110 // a qué distancia, delante de la cámara, aterriza
const START_ALTITUDE_METERS = 420 // sobre el suelo: arranca por encima del borde superior de la pantalla
const DESCENT_SECONDS = 10
const FOOTPRINT_RADIUS_METERS = 3.8 // radio de la base de la nave (con aletas) que no debe hundirse
const GROUND_CLEARANCE_METERS = 0.25
const MOON_GRAVITY = 1.62
const MOON_RADIUS_METERS = 1737400
const CAMERA_LOOK_UP_PITCH = 0.24 // la cámara mira un poco hacia arriba para ver entrar la nave por arriba
const CAMERA_PITCH_SECONDS = 1.4
const DUST_START_ALTITUDE = 80
const ENGINE_CUT_SECONDS = 3 // el motor sigue unos segundos tras el contacto, apagándose

const smoothstep = (value) => {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

/** Textura de una bocanada suave (blanco opaco al centro, transparente en el borde). */
function createPuffImage() {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.18)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return canvas
}

/**
 * Demostración de aterrizaje: el Saturn V baja desde arriba de la pantalla frenando con su motor (humo y
 * llama) y se posa en el terreno de las teselas, delante de la cámara.
 *
 * El suelo se lee de la malla de terreno que Cesium está dibujando (`globe.getHeight`, con la exageración
 * vertical aplicada) en 9 puntos de la base de la nave: se apoya sobre el más alto + un pequeño margen y se
 * vuelve a calcular en cada fotograma, así que no atraviesa la malla ni siquiera cuando las teselas se
 * refinan o se cambia la exageración vertical.
 *
 * `onChange(state)` recibe 'loading' | 'descending' | 'landed' | 'idle'.
 */
export function createLandingDemo({ viewer, controller, modelUrl, fallbackGroundHeight, getSun, onChange }) {
  const { scene } = viewer
  let state = 'idle'
  let model
  let plume
  let dust
  let removeListener
  let originalLight
  let landedAt = 0
  let site // { frame, h0, latitude, longitude }
  let token = 0

  const setState = (next) => {
    state = next
    onChange?.(next)
  }

  /** Altura visible (m, elipsoidal) del suelo que dibuja Cesium en (lat, lon) radianes. */
  const visibleGround = (latitude, longitude) => {
    const raw = scene.globe.getHeight(new Cartographic(longitude, latitude)) ?? fallbackGroundHeight(latitude, longitude)
    const relative = scene.verticalExaggerationRelativeHeight
    return relative + (raw - relative) * scene.verticalExaggeration
  }

  /** El punto más alto del suelo bajo la base de la nave (9 muestras: centro + anillo de 8). */
  const footprintGround = (latitude, longitude) => {
    const cosLat = Math.max(0.05, Math.cos(latitude))
    let highest = visibleGround(latitude, longitude)
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2
      const north = Math.cos(angle) * FOOTPRINT_RADIUS_METERS
      const east = Math.sin(angle) * FOOTPRINT_RADIUS_METERS
      highest = Math.max(highest, visibleGround(
        latitude + north / MOON_RADIUS_METERS,
        longitude + east / (MOON_RADIUS_METERS * cosLat),
      ))
    }
    return highest
  }

  const stop = () => {
    token += 1
    removeListener?.()
    removeListener = undefined
    if (model) { scene.primitives.remove(model); model = undefined }
    if (plume) { scene.primitives.remove(plume); plume = undefined }
    if (dust) { scene.primitives.remove(dust); dust = undefined }
    if (originalLight) { scene.light = originalLight; originalLight = undefined }
    if (state !== 'idle') setState('idle')
  }

  const start = async () => {
    stop()
    const myToken = token
    setState('loading')

    // Punto de aterrizaje: DISTANCE_AHEAD_METERS delante de la cámara, en la dirección en que mira.
    const ellipsoid = scene.globe.ellipsoid
    const cameraFrame = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromRadians(controller.longitude, controller.latitude, 0, ellipsoid),
    )
    const ahead = Matrix4.multiplyByPoint(
      cameraFrame,
      new Cartesian3(
        Math.sin(controller.heading) * DISTANCE_AHEAD_METERS,
        Math.cos(controller.heading) * DISTANCE_AHEAD_METERS,
        0,
      ),
      new Cartesian3(),
    )
    const landing = ellipsoid.cartesianToCartographic(ahead)
    const h0 = footprintGround(landing.latitude, landing.longitude)
    const frame = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromRadians(landing.longitude, landing.latitude, h0, ellipsoid),
    )
    site = { frame, h0, latitude: landing.latitude, longitude: landing.longitude }

    // Luz: el sol estimado de la imagen (o el supuesto), expresado en el marco del sitio.
    const sun = getSun?.()
    const azimuth = sun?.azimuth ?? Math.PI / 2
    const elevation = sun?.elevation ?? (30 * Math.PI) / 180
    const towardSun = new Cartesian3(
      Math.cos(elevation) * Math.sin(azimuth),
      Math.cos(elevation) * Math.cos(azimuth),
      Math.sin(elevation),
    )
    const worldTowardSun = Matrix4.multiplyByPointAsVector(frame, towardSun, new Cartesian3())
    originalLight = scene.light
    scene.light = new DirectionalLight({
      direction: Cartesian3.negate(Cartesian3.normalize(worldTowardSun, new Cartesian3()), new Cartesian3()),
      intensity: 2.5,
    })

    // Las partículas avanzan con el reloj de la escena, que en un visor sin animación está detenido.
    viewer.clock.shouldAnimate = true

    const puff = createPuffImage()
    plume = scene.primitives.add(new ParticleSystem({
      image: puff,
      imageSize: new Cartesian2(1, 1),
      sizeInMeters: true,
      startColor: new Color(1.0, 0.82, 0.5, 0.95),
      endColor: new Color(0.62, 0.62, 0.62, 0.0),
      startScale: 5,
      endScale: 26,
      minimumParticleLife: 0.9,
      maximumParticleLife: 2.2,
      minimumSpeed: 12,
      maximumSpeed: 24,
      emissionRate: 0,
      emitter: new ConeEmitter(CesiumMath.toRadians(11)),
      modelMatrix: frame,
      lifetime: Number.MAX_VALUE,
      loop: true,
    }))
    dust = scene.primitives.add(new ParticleSystem({
      image: puff,
      imageSize: new Cartesian2(1, 1),
      sizeInMeters: true,
      startColor: new Color(0.46, 0.44, 0.41, 0.4),
      endColor: new Color(0.4, 0.38, 0.36, 0.0),
      startScale: 2.5,
      endScale: 15,
      minimumParticleLife: 2.4,
      maximumParticleLife: 5.5,
      minimumSpeed: 5,
      maximumSpeed: 17,
      emissionRate: 0,
      emitter: new ConeEmitter(CesiumMath.toRadians(78)), // casi plano: la nube se extiende por el suelo
      modelMatrix: frame,
      lifetime: Number.MAX_VALUE,
      loop: true,
      // Sin atmósfera el polvo sigue arcos balísticos; aquí se frena un poco para que se lea como humo.
      updateCallback: (particle, dt) => {
        particle.velocity.z -= MOON_GRAVITY * dt
        Cartesian3.multiplyByScalar(particle.velocity, Math.max(0, 1 - 0.55 * dt), particle.velocity)
      },
    }))

    try {
      model = await Model.fromGltfAsync({
        url: modelUrl,
        scale: SHIP_HEIGHT_METERS / MODEL_NATIVE_HEIGHT,
        modelMatrix: frame,
        show: false,
        allowPicking: false,
        lightColor: new Cartesian3(2.4, 2.4, 2.4),
      })
    } catch (error) {
      if (myToken === token) stop()
      throw error
    }
    if (myToken !== token) {
      model.destroy?.()
      model = undefined
      return
    }
    scene.primitives.add(model)

    const startedAt = performance.now()
    landedAt = 0
    setState('descending')
    const startPitch = controller.pitch

    const update = () => {
      const now = performance.now()
      const elapsed = (now - startedAt) / 1000

      // La cámara sube un poco la vista al empezar para ver entrar la nave por el borde superior.
      if (elapsed < CAMERA_PITCH_SECONDS) {
        controller.pitch = startPitch + (CAMERA_LOOK_UP_PITCH - startPitch) * smoothstep(elapsed / CAMERA_PITCH_SECONDS)
      }

      const progress = Math.min(1, elapsed / DESCENT_SECONDS)
      // Frenada con velocidad nula al tocar el suelo: la altitud cae como (1 - t)^2.
      const altitude = START_ALTITUDE_METERS * (1 - progress) ** 2
      if (progress >= 1 && !landedAt) {
        landedAt = now
        setState('landed')
      }

      // Suelo bajo la base, recalculado cada fotograma (teselas que se refinan, exageración vertical...).
      const ground = footprintGround(site.latitude, site.longitude) + GROUND_CLEARANCE_METERS
      const z = ground - site.h0 + altitude // altura de la base en el marco ENU fijo del sitio

      model.modelMatrix = Matrix4.multiplyByTranslation(frame, new Cartesian3(0, 0, z), new Matrix4())
      model.show = true

      // Motor: emite mientras desciende y se apaga durante ENGINE_CUT_SECONDS tras el contacto.
      const sinceLanding = landedAt ? (now - landedAt) / 1000 : 0
      const throttle = landedAt ? Math.max(0, 1 - sinceLanding / ENGINE_CUT_SECONDS) : 1
      plume.emissionRate = 170 * throttle
      plume.emitterModelMatrix = Matrix4.fromRotationTranslation(
        Matrix3.fromRotationX(Math.PI), // el cono apunta hacia abajo
        new Cartesian3(0, 0, z + 0.4),
        new Matrix4(),
      )

      // Nube de polvo/humo a ras de suelo: crece al acercarse y se disipa tras apagar el motor.
      const nearness = smoothstep((DUST_START_ALTITUDE - altitude) / DUST_START_ALTITUDE)
      dust.emissionRate = 320 * nearness * throttle
      dust.emitterModelMatrix = Matrix4.fromTranslation(new Cartesian3(0, 0, ground - site.h0 + 0.6), new Matrix4())
    }
    scene.preRender.addEventListener(update)
    removeListener = () => scene.preRender.removeEventListener(update)
  }

  return {
    start,
    stop,
    get state() { return state },
  }
}
