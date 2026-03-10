export interface Point {
  x: number
  y: number
}

export interface OverlayConfig {
  corners: Point[]
  displacementIntensity: number
  transparency: number  // 0 = fully opaque, 1 = fully transparent
  textureData?: Record<string, unknown>
  mode: 'advanced' | 'basic'
  rotation?: number
  width?: number
  height?: number
  x?: number
  y?: number
}

export function getDefaultCorners(imgWidth: number, imgHeight: number): Point[] {
  const margin = 0.2
  return [
    { x: imgWidth * margin, y: imgHeight * margin },
    { x: imgWidth * (1 - margin), y: imgHeight * margin },
    { x: imgWidth * (1 - margin), y: imgHeight * (1 - margin) },
    { x: imgWidth * margin, y: imgHeight * (1 - margin) },
  ]
}

export function findClosestCorner(corners: Point[], pos: Point, threshold: number): number {
  let closest = -1
  let minDist = threshold
  for (let i = 0; i < corners.length; i++) {
    const dx = corners[i].x - pos.x
    const dy = corners[i].y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) {
      minDist = dist
      closest = i
    }
  }
  return closest
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  corners: Point[],
  previewImage: HTMLImageElement | null,
  scale: number,
) {
  ctx.save()

  ctx.beginPath()
  ctx.moveTo(corners[0].x * scale, corners[0].y * scale)
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x * scale, corners[i].y * scale)
  }
  ctx.closePath()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
  ctx.fill()

  for (const corner of corners) {
    ctx.beginPath()
    ctx.arc(corner.x * scale, corner.y * scale, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

export function drawPerspectivePreview(
  ctx: CanvasRenderingContext2D,
  templateImage: HTMLImageElement,
  designImage: HTMLImageElement,
  corners: Point[],
  scale: number,
) {
  ctx.drawImage(templateImage, 0, 0, templateImage.width * scale, templateImage.height * scale)

  ctx.save()
  ctx.globalAlpha = 0.85

  ctx.beginPath()
  ctx.moveTo(corners[0].x * scale, corners[0].y * scale)
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(corners[i].x * scale, corners[i].y * scale)
  }
  ctx.closePath()
  ctx.clip()

  const xs = corners.map((c) => c.x * scale)
  const ys = corners.map((c) => c.y * scale)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  ctx.drawImage(designImage, minX, minY, maxX - minX, maxY - minY)

  ctx.restore()
}
