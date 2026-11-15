import { jsPDF } from 'jspdf'

const COLORS = {
  background: [7, 18, 14],
  border: [42, 69, 54],
  white: [229, 237, 231],
  muted: [159, 180, 165],
  accent: [52, 205, 63],
  divider: [40, 61, 48],
}

function loadImageData(src, targetRatio) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1120
      canvas.height = Math.round(canvas.width / targetRatio)
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('No se pudo preparar la imagen de la misión.'))
        return
      }

      const sourceRatio = image.naturalWidth / image.naturalHeight
      const sourceWidth = sourceRatio > targetRatio
        ? image.naturalHeight * targetRatio
        : image.naturalWidth
      const sourceHeight = sourceRatio > targetRatio
        ? image.naturalHeight
        : image.naturalWidth / targetRatio
      const sourceX = (image.naturalWidth - sourceWidth) / 2
      const sourceY = (image.naturalHeight - sourceHeight) / 2
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    image.onerror = () => reject(new Error('No se pudo cargar la imagen de la misión.'))
    image.src = src
  })
}

function drawBackground(document) {
  const width = document.internal.pageSize.getWidth()
  const height = document.internal.pageSize.getHeight()
  document.setFillColor(...COLORS.background)
  document.rect(0, 0, width, height, 'F')
  document.setDrawColor(...COLORS.border)
  document.rect(8, 8, width - 16, height - 16)
}

function getFieldLayout(document, field, width) {
  const lines = document.splitTextToSize(field.value, width - 4)
  return { lines, height: 7 + lines.length * 4.2 }
}

function drawField(document, field, layout, x, y) {
  const labelY = y + 4
  const valueY = y + 10

  document.setFont('helvetica', 'normal')
  document.setFontSize(8.5)
  document.setTextColor(...COLORS.muted)
  document.text(field.label, x, labelY)
  document.setFontSize(10)
  document.setTextColor(...COLORS.white)
  document.text(layout.lines, x, valueY)
}

function makeFields({ form, missionProfile, siteName }) {
  const fields = [
    { label: 'Perfil', value: missionProfile.label },
    { label: 'Objetivo', value: `${form.objective} · ${form.duration}` },
    {
      label: 'Lanzador y carga',
      value: `${form.vehicle || 'Sin definir'} · ${form.mass ? `${form.mass} kg` : 'Masa no definida'} · ${form.payload}`,
    },
    { label: 'Lanzamiento', value: `${form.launchSite} · ${form.launchWindow}` },
    { label: 'Sitio', value: siteName },
    { label: 'Área y pendiente', value: `${form.landingArea} · ${form.maxSlope}` },
    { label: 'Altitud', value: `${form.elevation} m sobre el radio lunar medio` },
    { label: 'Coordenadas', value: `${Number(form.latitude).toFixed(4)}° · ${Number(form.longitude).toFixed(4)}° E` },
    { label: 'Aterrizaje (UTC)', value: `${form.dateTime.replace('T', ' · ')} UT` },
  ]

  if (missionProfile.conditionalSteps.includes('crew')) {
    fields.push({
      label: 'Tripulación y soporte',
      value: `${form.crewSize} · ${form.evaPlan} · ${form.lifeSupport}`,
    })
  }
  if (missionProfile.conditionalSteps.includes('logistics')) {
    fields.push({
      label: 'Logística',
      value: `${form.supplies} de reserva · energía ${form.redundancy} · ISRU ${form.isru}`,
    })
  }
  if (missionProfile.conditionalSteps.includes('sample')) {
    fields.push({
      label: 'Retorno de muestras',
      value: `${form.sampleTarget} · ${form.sampleCollection} · ${form.sampleReturn}`,
    })
  }

  return fields
}

function drawContinuationHeader(document) {
  const width = document.internal.pageSize.getWidth()
  drawBackground(document)
  document.setFont('helvetica', 'bold')
  document.setFontSize(11)
  document.setTextColor(...COLORS.accent)
  document.text('PLAN DE MISIÓN · CONTINUACIÓN', 14, 20)
  document.setDrawColor(...COLORS.divider)
  document.line(14, 25, width - 14, 25)
}

function drawVisibility(document, selectedSample, formatAngle, y) {
  const width = document.internal.pageSize.getWidth()
  const margin = 14
  const safeY = y > document.internal.pageSize.getHeight() - 23
  if (safeY) {
    document.addPage()
    drawContinuationHeader(document)
    y = 35
  }

  document.setDrawColor(...COLORS.divider)
  document.line(margin, y, width - margin, y)
  const solar = selectedSample
    ? `${selectedSample.sun.state === 'visible' ? 'visible' : 'oculto'} ${formatAngle(selectedSample.sun.elevation)}`
    : 'Sin datos calculados'
  const earth = selectedSample
    ? `${selectedSample.earth.state === 'visible' ? 'visible' : 'oculta'} ${formatAngle(selectedSample.earth.elevation)}`
    : 'Sin datos calculados'

  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.setTextColor(...COLORS.muted)
  document.text(`Sol ${solar}`, margin, y + 8)
  document.setTextColor(...COLORS.accent)
  document.text(`Tierra ${earth}`, margin + 44, y + 8)
}

export async function downloadMissionPlanPdf({ form, missionProfile, siteName, selectedSample, formatAngle }) {
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  const margin = 14
  const photo = { x: margin, y: 15, width: 112, height: 62 }
  const imageData = await loadImageData(
    missionProfile.photo,
    photo.width / photo.height
  )
  drawBackground(document)

  document.addImage(imageData, 'JPEG', photo.x, photo.y, photo.width, photo.height)
  document.setDrawColor(...COLORS.border)
  document.rect(photo.x, photo.y, photo.width, photo.height)

  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.setTextColor(...COLORS.muted)
  document.text('PLAN DE MISIÓN', 139, 34)
  document.setFontSize(19)
  document.setTextColor(...COLORS.white)
  document.text(form.name.trim() || 'Misión sin nombre', 139, 45)
  document.setDrawColor(...COLORS.divider)
  document.line(139, 54, pageWidth - margin, 54)

  const fields = makeFields({ form, missionProfile, siteName })
  const gap = 12
  const columnWidth = (pageWidth - margin * 2 - gap) / 2
  let y = 84

  for (let index = 0; index < fields.length; index += 2) {
    const row = fields.slice(index, index + 2)
    const layouts = row.map((field) => getFieldLayout(document, field, columnWidth))
    const rowHeight = Math.max(...layouts.map((layout) => layout.height))

    if (y + rowHeight + 2 > pageHeight - 29) {
      document.addPage()
      drawContinuationHeader(document)
      y = 33
    }

    row.forEach((field, column) => drawField(
      document,
      field,
      layouts[column],
      margin + column * (columnWidth + gap),
      y
    ))
    y += rowHeight + 2
  }

  drawVisibility(document, selectedSample, formatAngle, y + 2)
  const fileStem = form.name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'mision-lunar'
  document.save(`plan-${fileStem}.pdf`)
}
