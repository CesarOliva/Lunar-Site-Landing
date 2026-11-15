import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  loadWmtsTile,
  loadWmtsTiles,
} from './moonTiles.js'
import {
  GLOBE_ROTATION,
  createTerrainGeometry,
  directionFromLatLon,
  elevationLayer,
  imageryLayer,
  latLonFromDirection,
} from './globe.js'

function createDetailTile(imageBitmap, elevationBitmap, matrix, row, column, rotationY, maxAnisotropy) {
  const canvas = document.createElement('canvas')
  canvas.width = elevationBitmap.width
  canvas.height = elevationBitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo leer la tesela de elevación.')
  context.drawImage(elevationBitmap, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data

  const geometry = new THREE.SphereGeometry(
    2.003,
    64,
    64,
    (2 * Math.PI * column) / matrix.matrixWidth,
    (2 * Math.PI) / matrix.matrixWidth,
    (Math.PI * row) / matrix.matrixHeight,
    Math.PI / matrix.matrixHeight,
  )
  const positions = geometry.attributes.position
  const uvs = geometry.attributes.uv
  const direction = new THREE.Vector3()

  for (let index = 0; index < positions.count; index += 1) {
    const u = Math.max(0, Math.min(1, uvs.getX(index)))
    const v = Math.max(0, Math.min(1, uvs.getY(index)))
    const x = Math.min(canvas.width - 1, Math.floor(u * canvas.width))
    const y = Math.min(canvas.height - 1, Math.floor((1 - v) * canvas.height))
    const pixelIndex = (y * canvas.width + x) * 4
    const intensity = pixels[pixelIndex]
    const alpha = pixels[pixelIndex + 3] / 255
    const radius = 2.003 + ((intensity / 255) - 0.5) * 0.045 * alpha
    direction.fromBufferAttribute(positions, index).normalize()
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius)
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  canvas.width = 0
  canvas.height = 0

  const texture = new THREE.Texture(imageBitmap)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = maxAnisotropy
  texture.needsUpdate = true

  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.y = rotationY
  return { mesh, geometry, material, texture }
}

function disposeDetailTile(entry) {
  entry.meshes.forEach(({ mesh, geometry, material, texture }) => {
    mesh.removeFromParent()
    geometry.dispose()
    material.dispose()
    texture.dispose()
  })
  entry.bitmaps.forEach((bitmap) => bitmap.close())
}

function createStarField() {
  const positions = new Float32Array(1500 * 3)
  for (let index = 0; index < 1500; index += 1) {
    const radius = 9 + Math.random() * 8
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos((Math.random() * 2) - 1)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[index * 3 + 1] = radius * Math.cos(phi)
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#b8c2d7', size: 0.018, transparent: true, opacity: 0.7 }),
  )
}

function MoonScene({
  viewerRef,
  autoRotate,
  qualityLevel,
  selectionEnabled,
  selectedPoint,
  onPointSelected,
  onProgress,
  onError,
  onReady,
}) {
  const controlsRef = useRef(null)
  const startAnimationRef = useRef(null)
  const stopAnimationRef = useRef(null)
  const selectionEnabledRef = useRef(selectionEnabled)
  const selectedPointRef = useRef(selectedPoint)

  useEffect(() => {
    selectionEnabledRef.current = selectionEnabled
  }, [selectionEnabled])

  useEffect(() => {
    selectedPointRef.current = selectedPoint
  }, [selectedPoint])

  useEffect(() => {
    const host = document.querySelector('.scene-host')
    if (!host) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(0, 0, 6.5)

    let renderer
    let controls
    let moon
    let selectedMarker
    let currentSelectedPoint = selectedPointRef.current
    let animationFrame
    let detailRefreshTimer
    let lastAutomaticDetailRefresh = 0
    let requestVisibleDetails
    let detailController
    let detailGeneration = 0
    let detailRequests = 0
    let regionKey = ''
    let imageryBase
    let elevationBase
    let texture
    let terrainGeometry
    let terrainMaterial
    let markerMaterial
    const detailTiles = new Map()
    const detailLoaded = { imagery: 0, elevation: 0 }
    const detailFailed = { imagery: 0, elevation: 0 }
    const abortController = new AbortController()
    const streamed = qualityLevel >= 4
    const tileBudget = qualityLevel === 4 ? 1024 : 2048
    const baseQualityLevel = streamed ? 3 : qualityLevel
    const globeRotation = GLOBE_ROTATION

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor(0x000000, 0)
      renderer.domElement.className = 'moon-canvas'
      renderer.domElement.setAttribute('aria-label', 'Modelo 3D de la Luna. Arrastra para rotar y usa la rueda para acercar.')
      host.prepend(renderer.domElement)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.055
      controls.minDistance = 2.8
      controls.maxDistance = 9
      controls.autoRotate = false
      controls.autoRotateSpeed = 0.42
      controls.enablePan = false
      controls.listenToKeyEvents(window)
      controlsRef.current = controls
      renderer.domElement.tabIndex = 0

      scene.add(new THREE.AmbientLight(0xffffff, 1.25))
      const keyLight = new THREE.DirectionalLight(0xffffff, 3.1)
      keyLight.position.set(-4.5, 2.8, 5)
      scene.add(keyLight)
      const rimLight = new THREE.DirectionalLight(0xaab5c5, 1.15)
      rimLight.position.set(4, -2, -4)
      scene.add(rimLight)
      scene.add(createStarField())
    } catch (error) {
      onError(`WebGL no está disponible en este navegador: ${error.message}`)
      return undefined
    }

    const renderScene = () => renderer.render(scene, camera)
    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      if (!controls.autoRotate) renderScene()
    }

    const renderFrame = () => {
      controls.update()
      renderScene()
      if (controls.autoRotate) animationFrame = window.requestAnimationFrame(renderFrame)
      else animationFrame = undefined
    }
    const startAnimation = () => {
      if (!animationFrame) {
        renderFrame()
      }
    }
    const stopAnimation = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      animationFrame = undefined
      controls.update()
      renderScene()
    }

    const scheduleDetailUpdate = () => {
      if (!streamed || !requestVisibleDetails) return
      if (controls.autoRotate) {
        const now = Date.now()
        if (now - lastAutomaticDetailRefresh < 1200) return
        lastAutomaticDetailRefresh = now
        requestVisibleDetails()
        return
      }

      window.clearTimeout(detailRefreshTimer)
      detailRefreshTimer = window.setTimeout(() => requestVisibleDetails?.(), 350)
    }

    const onControlsChange = () => {
      if (!controls.autoRotate) renderScene()
      scheduleDetailUpdate()
    }

    const onPointerDown = (event) => {
      if (event.button !== 0 || !selectionEnabledRef.current) return
      selectionPointer = { x: event.clientX, y: event.clientY }
    }

    const onPointerCancel = () => {
      selectionPointer = null
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let selectionPointer = null
    const onPointerUp = (event) => {
      if (!selectionPointer || !selectionEnabledRef.current || !moon) {
        selectionPointer = null
        return
      }
      const moved = Math.hypot(event.clientX - selectionPointer.x, event.clientY - selectionPointer.y)
      selectionPointer = null
      if (moved > 5) return

      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(moon, false)[0]
      if (!hit) return

      const localDirection = hit.point.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -globeRotation)
        .normalize()
      onPointSelected(latLonFromDirection(localDirection))
    }

    const updateSelectedMarker = (point) => {
      currentSelectedPoint = point
      if (!moon) return
      if (!point) {
        selectedMarker?.removeFromParent()
        renderScene()
        return
      }

      const direction = directionFromLatLon(point.latitude, point.longitude)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), globeRotation).normalize()

      if (!selectedMarker) {
        selectedMarker = new THREE.Group()
        markerMaterial = new THREE.MeshStandardMaterial({
          color: '#c4e577',
          emissive: '#607a2d',
          emissiveIntensity: 1.6,
        })
        const pointMesh = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), markerMaterial)
        const ringMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.04, 0.004, 8, 24),
          markerMaterial,
        )
        selectedMarker.add(pointMesh, ringMesh)
        scene.add(selectedMarker)
      }

      selectedMarker.position.copy(direction.multiplyScalar(2.035))
      selectedMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
      selectedMarker.visible = true
      renderScene()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()
    controls.addEventListener('change', onControlsChange)
    controls.addEventListener('end', scheduleDetailUpdate)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerCancel)
    startAnimationRef.current = startAnimation
    stopAnimationRef.current = stopAnimation

    viewerRef.current = {
      zoomIn: () => {
        camera.position.multiplyScalar(0.82)
        controls.update()
        renderScene()
        scheduleDetailUpdate()
      },
      zoomOut: () => {
        camera.position.multiplyScalar(1.22)
        controls.update()
        renderScene()
        scheduleDetailUpdate()
      },
      resetView: () => {
        camera.position.set(0, 0, 6.5)
        controls.target.set(0, 0, 0)
        controls.update()
        renderScene()
        scheduleDetailUpdate()
      },
      setSelectedPoint: updateSelectedMarker,
      // La vista de superficie (Cesium) cubre el globo: se suspenden sus controles y su animación.
      setSuspended: (suspended) => {
        controls.enabled = !suspended
        if (suspended) stopAnimation()
      },
    }

    const reportProgress = (layer) => (value) => onProgress(layer, value)

    Promise.all([
      loadWmtsTiles(imageryLayer, baseQualityLevel, abortController.signal, reportProgress('imagery')),
      loadWmtsTiles(elevationLayer, baseQualityLevel, abortController.signal, reportProgress('elevation')),
    ])
      .then(([imagery, elevation]) => {
        if (abortController.signal.aborted) return
        imageryBase = imagery
        elevationBase = elevation
        texture = new THREE.CanvasTexture(imagery.canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        terrainGeometry = createTerrainGeometry(elevation, baseQualityLevel)
        terrainMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 1,
          metalness: 0,
        })
        moon = new THREE.Mesh(terrainGeometry, terrainMaterial)
        moon.rotation.y = globeRotation
        scene.add(moon)
        updateSelectedMarker(currentSelectedPoint)
        renderScene()

        if (!streamed) {
          onReady()
          return
        }

        const reportStreamedProgress = () => {
          onProgress('imagery', {
            loaded: imageryBase.loaded + detailLoaded.imagery,
            total: imageryBase.total + detailRequests / 2,
            failed: imageryBase.failed + detailFailed.imagery,
          })
          onProgress('elevation', {
            loaded: elevationBase.loaded + detailLoaded.elevation,
            total: elevationBase.total + detailRequests / 2,
            failed: elevationBase.failed + detailFailed.elevation,
          })
        }

        const requestTile = async (row, column, generation, signal) => {
          if (signal.aborted || generation !== detailGeneration) return
          detailRequests += 2
          reportStreamedProgress()
          const results = await Promise.allSettled([
            loadWmtsTile(imageryLayer, imagery.matrix, 5, row, column, signal),
            loadWmtsTile(elevationLayer, elevation.matrix, 5, row, column, signal),
          ])

          if (signal.aborted || generation !== detailGeneration) {
            results.forEach((result) => {
              if (result.status === 'fulfilled') result.value.close()
            })
            detailRequests -= 2
            reportStreamedProgress()
            return
          }

          const [imageResult, elevationResult] = results
          if (imageResult.status !== 'fulfilled' || elevationResult.status !== 'fulfilled') {
            if (imageResult.status === 'fulfilled') imageResult.value.close()
            if (elevationResult.status === 'fulfilled') elevationResult.value.close()
            if (imageResult.status === 'fulfilled') detailLoaded.imagery += 1
            else detailFailed.imagery += 1
            if (elevationResult.status === 'fulfilled') detailLoaded.elevation += 1
            else detailFailed.elevation += 1
            reportStreamedProgress()
            return
          }

          try {
            const imageBitmap = imageResult.value
            const elevationBitmap = elevationResult.value
            const detailMesh = createDetailTile(
              imageBitmap,
              elevationBitmap,
              elevation.matrix.matrices.find((matrix) => matrix.matrixId === '5'),
              row,
              column,
              globeRotation,
              renderer.capabilities.getMaxAnisotropy(),
            )
            scene.add(detailMesh.mesh)
            detailTiles.set(`${row}/${column}`, {
              meshes: [detailMesh],
              bitmaps: [imageBitmap, elevationBitmap],
            })
            detailLoaded.imagery += 1
            detailLoaded.elevation += 1
            reportStreamedProgress()
          } catch (error) {
            imageResult.value.close()
            elevationResult.value.close()
            detailFailed.elevation += 1
            reportStreamedProgress()
            onError(`No se pudo preparar una tesela de detalle: ${error.message}`)
          }
        }

        requestVisibleDetails = () => {
          if (abortController.signal.aborted || !moon) return
          const matrix = elevation.matrix.matrices.find((item) => item.matrixId === '5')
          if (!matrix) {
            onError('La matriz WMTS de detalle nivel 5 no está disponible para LOLA.')
            return
          }

          const direction = camera.position.clone().normalize()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), -globeRotation)
          const { latitude, longitude } = latLonFromDirection(direction)
          const centerColumn = Math.min(
            matrix.matrixWidth - 1,
            Math.floor((((longitude + 180 + 360) % 360) / 360) * matrix.matrixWidth),
          )
          const centerRow = Math.max(0, Math.min(
            matrix.matrixHeight - 1,
            Math.floor(((90 - latitude) / 180) * matrix.matrixHeight),
          ))
          const nextRegionKey = `${centerRow}/${centerColumn}`
          if (nextRegionKey === regionKey) return
          const region = []
          for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
            const row = centerRow + rowOffset
            if (row < 0 || row >= matrix.matrixHeight) continue
            for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
              const column = (centerColumn + columnOffset + matrix.matrixWidth) % matrix.matrixWidth
              region.push({ row, column, key: `${row}/${column}` })
            }
          }

          const wantedKeys = new Set(region.map((tile) => tile.key))
          const missingTiles = region.filter((tile) => !detailTiles.has(tile.key))
          const remainingPairs = Math.floor(
            Math.max(0, tileBudget - imageryBase.total - elevationBase.total - detailRequests) / 2,
          )
          regionKey = nextRegionKey
          if (missingTiles.length && remainingPairs === 0) return

          detailGeneration += 1
          detailController?.abort()
          const controller = new AbortController()
          detailController = controller
          const abortWithScene = () => controller.abort()
          abortController.signal.addEventListener('abort', abortWithScene, { once: true })
          const generation = detailGeneration

          detailTiles.forEach((entry, key) => {
            if (wantedKeys.has(key)) return
            disposeDetailTile(entry)
            detailTiles.delete(key)
          })

          const tilesToLoad = missingTiles.slice(0, remainingPairs)
          let nextTile = 0
          const workers = Array.from({ length: Math.min(3, tilesToLoad.length) }, async () => {
            while (nextTile < tilesToLoad.length && !controller.signal.aborted) {
              const { row, column } = tilesToLoad[nextTile]
              nextTile += 1
              await requestTile(row, column, generation, controller.signal)
            }
          })
          Promise.all(workers).catch((error) => {
            if (!controller.signal.aborted) onError(error.message)
          }).finally(() => {
            abortController.signal.removeEventListener('abort', abortWithScene)
          })
        }

        reportStreamedProgress()
        onReady()
        requestVisibleDetails()
      })
      .catch((error) => {
        if (!abortController.signal.aborted) onError(error.message)
      })

    return () => {
      abortController.abort()
      detailController?.abort()
      window.clearTimeout(detailRefreshTimer)
      stopAnimation()
      resizeObserver.disconnect()
      controls.removeEventListener('change', onControlsChange)
      controls.removeEventListener('end', scheduleDetailUpdate)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      controls.dispose()
      controlsRef.current = null
      startAnimationRef.current = null
      stopAnimationRef.current = null
      if (viewerRef.current) viewerRef.current = null
      detailTiles.forEach(disposeDetailTile)
      selectedMarker?.traverse((object) => {
        if (object.isMesh) object.geometry.dispose()
      })
      markerMaterial?.dispose()
      if (moon) scene.remove(moon)
      terrainGeometry?.dispose()
      terrainMaterial?.dispose()
      texture?.dispose()
      scene.traverse((object) => {
        if (object.isPoints) {
          object.geometry.dispose()
          object.material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [onError, onProgress, onReady, onPointSelected, qualityLevel, viewerRef])

  useEffect(() => {
    if (!controlsRef.current) return
    controlsRef.current.autoRotate = autoRotate
    if (autoRotate) startAnimationRef.current?.()
    else stopAnimationRef.current?.()
  }, [autoRotate])

  useEffect(() => {
    viewerRef.current?.setSelectedPoint(selectedPoint)
  }, [selectedPoint, viewerRef])

  return <div className="scene-host" />
}

export default MoonScene
