import { Cartesian3, Cartographic, Math as CesiumMath } from 'cesium'

const EYE_HEIGHT_METERS = 1.7
const WALK_SPEED = 4 // m/s
const RUN_MULTIPLIER = 6
const LOOK_SENSITIVITY = 0.003
const MOON_RADIUS_METERS = 1737400

const KEY_DIRECTIONS = {
  w: 'forward', arrowup: 'forward',
  s: 'backward', arrowdown: 'backward',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
}

/**
 * Cámara a pie sobre el terreno de Cesium: WASD/flechas para caminar (Shift corre),
 * arrastrar para mirar. La altura sigue el terreno renderizado.
 */
export class FirstPersonController {
  constructor(viewer, { getGroundHeight }) {
    this.viewer = viewer
    this.getGroundHeight = getGroundHeight
    this.latitude = 0
    this.longitude = 0
    this.heading = 0
    this.pitch = -0.04
    this.active = false
    this.running = false
    this.directions = new Set()
    this.lookPointer = null
    this.lastTime = 0
    this.onMove = undefined

    const canvas = viewer.scene.canvas
    canvas.tabIndex = 0
    this.canvas = canvas

    this.handleKeyDown = (event) => {
      if (!this.active) return
      const key = event.key.toLowerCase()
      if (key === 'shift') this.running = true
      const direction = KEY_DIRECTIONS[key]
      if (!direction) return
      event.preventDefault()
      this.directions.add(direction)
    }
    this.handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (key === 'shift') this.running = false
      const direction = KEY_DIRECTIONS[key]
      if (direction) this.directions.delete(direction)
    }
    this.handlePointerDown = (event) => {
      if (!this.active) return
      this.lookPointer = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    }
    this.handlePointerMove = (event) => {
      if (!this.lookPointer) return
      this.heading += (event.clientX - this.lookPointer.x) * LOOK_SENSITIVITY
      this.pitch = CesiumMath.clamp(
        this.pitch - (event.clientY - this.lookPointer.y) * LOOK_SENSITIVITY,
        -1.4,
        1.4,
      )
      this.lookPointer = { x: event.clientX, y: event.clientY }
    }
    this.handlePointerUp = () => { this.lookPointer = null }
    this.handlePreRender = () => this.update()

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointercancel', this.handlePointerUp)
    viewer.scene.preRender.addEventListener(this.handlePreRender)
  }

  setActive(active) {
    this.active = active
    if (!active) {
      this.directions.clear()
      this.lookPointer = null
    } else {
      this.canvas.focus()
    }
  }

  setWalking(direction, isMoving) {
    if (!this.active) return
    if (isMoving) this.directions.add(direction)
    else this.directions.delete(direction)
  }

  teleport(latitudeDegrees, longitudeDegrees) {
    this.latitude = CesiumMath.toRadians(latitudeDegrees)
    this.longitude = CesiumMath.toRadians(longitudeDegrees)
    this.lastTime = 0
    this.apply()
  }

  /** Altura visible del suelo bajo el jugador, aplicando la exageración vertical activa. */
  groundHeight() {
    const scene = this.viewer.scene
    const raw = this.getGroundHeight(this.latitude, this.longitude)
    const relative = scene.verticalExaggerationRelativeHeight
    return relative + (raw - relative) * scene.verticalExaggeration
  }

  apply() {
    const height = this.groundHeight() + EYE_HEIGHT_METERS
    this.viewer.camera.setView({
      destination: Cartesian3.fromRadians(this.longitude, this.latitude, height),
      orientation: { heading: this.heading, pitch: this.pitch, roll: 0 },
    })
  }

  update() {
    const now = performance.now()
    const delta = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.1) : 0
    this.lastTime = now

    if (this.active && this.directions.size && delta) {
      const speed = WALK_SPEED * (this.running ? RUN_MULTIPLIER : 1) * delta
      const forward = (this.directions.has('forward') ? 1 : 0) - (this.directions.has('backward') ? 1 : 0)
      const side = (this.directions.has('right') ? 1 : 0) - (this.directions.has('left') ? 1 : 0)
      const east = (Math.sin(this.heading) * forward + Math.cos(this.heading) * side) * speed
      const north = (Math.cos(this.heading) * forward - Math.sin(this.heading) * side) * speed
      this.latitude = CesiumMath.clamp(this.latitude + north / MOON_RADIUS_METERS, -1.5, 1.5)
      this.longitude += east / (MOON_RADIUS_METERS * Math.cos(this.latitude))
      this.onMove?.(CesiumMath.toDegrees(this.latitude), CesiumMath.toDegrees(this.longitude))
    }
    this.apply()
  }

  position() {
    return Cartographic.fromRadians(this.longitude, this.latitude)
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp)
    if (!this.viewer.isDestroyed()) this.viewer.scene.preRender.removeEventListener(this.handlePreRender)
  }
}
