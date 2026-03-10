'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { Point, OverlayConfig, CurveAxis, getDefaultCorners, findClosestCorner } from '@/lib/canvas-utils'

interface MockupCanvasProps {
  imageUrl: string
  overlayConfig: OverlayConfig | null
  previewDesignUrl?: string
  transparency?: number
  displacement?: number
  curvature?: number
  curveAxis?: CurveAxis
  onConfigChange: (config: OverlayConfig) => void
  mode: 'advanced' | 'basic'
}

export function MockupCanvas({
  imageUrl, overlayConfig, previewDesignUrl,
  transparency = 0, displacement = 0.5,
  curvature = 0, curveAxis = 'auto',
  onConfigChange, mode,
}: MockupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [designImage, setDesignImage] = useState<HTMLImageElement | null>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [dragging, setDragging] = useState(-1)
  const [scale, setScale] = useState(1)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      if (!overlayConfig) {
        const defaultCorners = getDefaultCorners(img.width, img.height)
        setCorners(defaultCorners)
        onConfigChange({ corners: defaultCorners, displacementIntensity: 0.5, transparency: 0, mode })
      } else {
        setCorners(overlayConfig.corners)
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    if (!previewDesignUrl) {
      setDesignImage(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setDesignImage(img)
    img.src = previewDesignUrl
  }, [previewDesignUrl])

  useEffect(() => {
    if (!image || !containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const s = Math.min(1, containerWidth / image.width)
    setScale(s)
  }, [image])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !image) return

    canvas.width = image.width * scale
    canvas.height = image.height * scale

    ctx.drawImage(image, 0, 0, image.width * scale, image.height * scale)

    if (showPreview && designImage) {
      drawRealisticPreview(ctx, image, designImage, corners, scale, transparency, displacement, curvature, curveAxis)
    } else {
      drawOverlayWithCurvature(ctx, corners, scale, curvature, curveAxis)
    }
  }, [image, designImage, corners, scale, showPreview, transparency, displacement, curvature, curveAxis])

  useEffect(() => { render() }, [render])

  const getMousePos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (showPreview) return
    const pos = getMousePos(e)
    const idx = findClosestCorner(corners, pos, 20 / scale)
    if (idx >= 0) setDragging(idx)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging < 0) return
    const pos = getMousePos(e)
    const newCorners = [...corners]
    newCorners[dragging] = pos
    setCorners(newCorners)
  }

  const handleMouseUp = () => {
    if (dragging >= 0) {
      onConfigChange({
        corners, displacementIntensity: overlayConfig?.displacementIntensity ?? 0.5,
        transparency: overlayConfig?.transparency ?? 0, mode,
        curvature: overlayConfig?.curvature ?? 0,
        curveAxis: overlayConfig?.curveAxis ?? 'auto',
      })
    }
    setDragging(-1)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-2 flex gap-2">
        <button onClick={() => setShowPreview(false)}
          className={`px-3 py-1 text-sm rounded ${!showPreview ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
          Edit
        </button>
        <button onClick={() => setShowPreview(true)} disabled={!designImage}
          className={`px-3 py-1 text-sm rounded ${showPreview ? 'bg-blue-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}>
          Preview
        </button>
        {showPreview && !designImage && (
          <span className="text-sm text-gray-400 self-center">Select a design above to preview</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`rounded-lg border shadow-sm ${showPreview ? 'cursor-default' : 'cursor-crosshair'}`}
      />
    </div>
  )
}


/**
 * Resolve the effective curve axis based on quad dimensions.
 */
function resolveAxis(corners: Point[], curveAxis: CurveAxis): 'horizontal' | 'vertical' {
  if (curveAxis !== 'auto') return curveAxis
  const topW = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y)
  const botW = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)
  const leftH = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y)
  const rightH = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)
  const avgW = (topW + botW) / 2
  const avgH = (leftH + rightH) / 2
  return avgW > avgH * 1.3 ? 'vertical' : 'horizontal'
}


/**
 * Draw overlay quad with curved edges to visualize curvature effect.
 * When curvature is 0, draws straight lines (same as before).
 * When curvature != 0, bows the appropriate edges inward using bezier curves.
 */
function drawOverlayWithCurvature(
  ctx: CanvasRenderingContext2D,
  corners: Point[],
  scale: number,
  curvature: number,
  curveAxis: CurveAxis,
) {
  if (corners.length !== 4) return

  ctx.save()
  const sc = corners.map((c) => ({ x: c.x * scale, y: c.y * scale }))
  const axis = resolveAxis(corners, curveAxis)
  // Bow amount: how far the midpoint of curved edges shifts inward
  const bow = curvature * 0.3 // Scale down for visual — full curvature bows edges 30% of span

  ctx.beginPath()

  if (Math.abs(curvature) < 0.01) {
    // Straight lines (no curvature)
    ctx.moveTo(sc[0].x, sc[0].y)
    ctx.lineTo(sc[1].x, sc[1].y)
    ctx.lineTo(sc[2].x, sc[2].y)
    ctx.lineTo(sc[3].x, sc[3].y)
  } else if (axis === 'horizontal') {
    // Curve left and right edges (TL→BL and TR→BR)
    const leftMidX = (sc[0].x + sc[3].x) / 2
    const leftMidY = (sc[0].y + sc[3].y) / 2
    const rightMidX = (sc[1].x + sc[2].x) / 2
    const rightMidY = (sc[1].y + sc[2].y) / 2

    // Horizontal span for bow calculation
    const span = Math.abs(rightMidX - leftMidX)
    const leftBowX = leftMidX + bow * span
    const rightBowX = rightMidX - bow * span

    ctx.moveTo(sc[0].x, sc[0].y)
    // Top edge: straight
    ctx.lineTo(sc[1].x, sc[1].y)
    // Right edge: curved
    ctx.quadraticCurveTo(rightBowX, rightMidY, sc[2].x, sc[2].y)
    // Bottom edge: straight
    ctx.lineTo(sc[3].x, sc[3].y)
    // Left edge: curved
    ctx.quadraticCurveTo(leftBowX, leftMidY, sc[0].x, sc[0].y)
  } else {
    // Curve top and bottom edges (TL→TR and BL→BR)
    const topMidX = (sc[0].x + sc[1].x) / 2
    const topMidY = (sc[0].y + sc[1].y) / 2
    const botMidX = (sc[3].x + sc[2].x) / 2
    const botMidY = (sc[3].y + sc[2].y) / 2

    const span = Math.abs(botMidY - topMidY)
    const topBowY = topMidY + bow * span
    const botBowY = botMidY - bow * span

    ctx.moveTo(sc[0].x, sc[0].y)
    // Top edge: curved
    ctx.quadraticCurveTo(topMidX, topBowY, sc[1].x, sc[1].y)
    // Right edge: straight
    ctx.lineTo(sc[2].x, sc[2].y)
    // Bottom edge: curved
    ctx.quadraticCurveTo(botMidX, botBowY, sc[3].x, sc[3].y)
    // Left edge: straight
    ctx.lineTo(sc[0].x, sc[0].y)
  }

  ctx.closePath()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
  ctx.fill()

  // Draw corner handles
  for (const corner of sc) {
    ctx.beginPath()
    ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Show axis indicator when curvature is active
  if (Math.abs(curvature) >= 0.01) {
    const centerX = (sc[0].x + sc[1].x + sc[2].x + sc[3].x) / 4
    const centerY = (sc[0].y + sc[1].y + sc[2].y + sc[3].y) / 4
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
    ctx.textAlign = 'center'
    const label = `${Math.round(curvature * 100)}% ${axis === 'horizontal' ? '↔' : '↕'}`
    ctx.fillText(label, centerX, centerY)
  }

  ctx.restore()
}


/**
 * Draw a realtime preview that approximates the server-side render:
 * - Perspective-clips the design into the overlay quad
 * - Applies transparency (globalAlpha)
 * - Simulates multiply blend for displacement effect
 * - Approximates curvature with horizontal/vertical scaling
 */
function drawRealisticPreview(
  ctx: CanvasRenderingContext2D,
  templateImage: HTMLImageElement,
  designImage: HTMLImageElement,
  corners: Point[],
  scale: number,
  transparency: number,
  displacement: number,
  curvature: number,
  curveAxis: CurveAxis,
) {
  const w = templateImage.width * scale
  const h = templateImage.height * scale

  // Draw template base
  ctx.drawImage(templateImage, 0, 0, w, h)

  if (corners.length !== 4) return

  // Get scaled corners
  const sc = corners.map((c) => ({ x: c.x * scale, y: c.y * scale }))

  // Calculate bounding box of the quad
  const xs = sc.map((c) => c.x)
  const ys = sc.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const quadW = maxX - minX
  const quadH = maxY - minY

  if (quadW < 1 || quadH < 1) return

  // Calculate design dimensions preserving aspect ratio within quad
  const designAspect = designImage.width / designImage.height
  const quadAspect = quadW / quadH
  let drawW: number, drawH: number, drawX: number, drawY: number
  if (designAspect > quadAspect) {
    drawW = quadW
    drawH = quadW / designAspect
    drawX = minX
    drawY = minY + (quadH - drawH) / 2
  } else {
    drawH = quadH
    drawW = quadH * designAspect
    drawX = minX + (quadW - drawW) / 2
    drawY = minY
  }

  // Clip to overlay quad (use curved path if curvature is set)
  const axis = resolveAxis(corners, curveAxis)
  ctx.save()
  ctx.beginPath()

  if (Math.abs(curvature) < 0.01) {
    ctx.moveTo(sc[0].x, sc[0].y)
    for (let i = 1; i < 4; i++) ctx.lineTo(sc[i].x, sc[i].y)
  } else {
    const bow = curvature * 0.3
    if (axis === 'horizontal') {
      const leftMidX = (sc[0].x + sc[3].x) / 2
      const leftMidY = (sc[0].y + sc[3].y) / 2
      const rightMidX = (sc[1].x + sc[2].x) / 2
      const rightMidY = (sc[1].y + sc[2].y) / 2
      const span = Math.abs(rightMidX - leftMidX)
      ctx.moveTo(sc[0].x, sc[0].y)
      ctx.lineTo(sc[1].x, sc[1].y)
      ctx.quadraticCurveTo(rightMidX - bow * span, rightMidY, sc[2].x, sc[2].y)
      ctx.lineTo(sc[3].x, sc[3].y)
      ctx.quadraticCurveTo(leftMidX + bow * span, leftMidY, sc[0].x, sc[0].y)
    } else {
      const topMidX = (sc[0].x + sc[1].x) / 2
      const topMidY = (sc[0].y + sc[1].y) / 2
      const botMidX = (sc[3].x + sc[2].x) / 2
      const botMidY = (sc[3].y + sc[2].y) / 2
      const span = Math.abs(botMidY - topMidY)
      ctx.moveTo(sc[0].x, sc[0].y)
      ctx.quadraticCurveTo(topMidX, topMidY + bow * span, sc[1].x, sc[1].y)
      ctx.lineTo(sc[2].x, sc[2].y)
      ctx.quadraticCurveTo(botMidX, botMidY - bow * span, sc[3].x, sc[3].y)
      ctx.lineTo(sc[0].x, sc[0].y)
    }
  }
  ctx.closePath()
  ctx.clip()

  // Simulate curvature in preview: compress design edges along curve axis
  // This is a rough approximation — the real barrel distortion happens server-side
  const opacity = 1 - transparency

  if (displacement > 0.1) {
    ctx.globalAlpha = opacity
    ctx.drawImage(designImage, drawX, drawY, drawW, drawH)

    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = displacement * 0.6
    ctx.drawImage(templateImage, 0, 0, w, h)

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  } else {
    ctx.globalAlpha = opacity
    ctx.drawImage(designImage, drawX, drawY, drawW, drawH)
    ctx.globalAlpha = 1
  }

  ctx.restore()
}
