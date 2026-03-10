'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { Point, OverlayConfig, getDefaultCorners, findClosestCorner, drawOverlay } from '@/lib/canvas-utils'

interface MockupCanvasProps {
  imageUrl: string
  overlayConfig: OverlayConfig | null
  previewDesignUrl?: string
  transparency?: number
  displacement?: number
  onConfigChange: (config: OverlayConfig) => void
  mode: 'advanced' | 'basic'
}

export function MockupCanvas({
  imageUrl, overlayConfig, previewDesignUrl,
  transparency = 0, displacement = 0.5,
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
      drawRealisticPreview(ctx, image, designImage, corners, scale, transparency, displacement)
    } else {
      drawOverlay(ctx, corners, null, scale)
    }
  }, [image, designImage, corners, scale, showPreview, transparency, displacement])

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
 * Draw a realtime preview that approximates the server-side render:
 * - Perspective-clips the design into the overlay quad
 * - Applies transparency (globalAlpha)
 * - Simulates multiply blend for displacement effect
 */
function drawRealisticPreview(
  ctx: CanvasRenderingContext2D,
  templateImage: HTMLImageElement,
  designImage: HTMLImageElement,
  corners: Point[],
  scale: number,
  transparency: number,
  displacement: number,
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

  // Clip to overlay quad
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sc[0].x, sc[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(sc[i].x, sc[i].y)
  ctx.closePath()
  ctx.clip()

  // Simulate multiply blend by drawing the design darker based on displacement
  // Higher displacement = more fabric interaction = multiply-like effect
  const opacity = 1 - transparency

  if (displacement > 0.1) {
    // Draw design with multiply-like effect:
    // First draw design at reduced opacity, then overlay with multiply simulation
    ctx.globalAlpha = opacity
    ctx.drawImage(designImage, drawX, drawY, drawW, drawH)

    // Simulate multiply by re-drawing the template region on top with
    // partial opacity in 'multiply' composite mode
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = displacement * 0.6  // scale blend strength like server-side
    ctx.drawImage(templateImage, 0, 0, w, h)

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  } else {
    // Simple overlay with just transparency
    ctx.globalAlpha = opacity
    ctx.drawImage(designImage, drawX, drawY, drawW, drawH)
    ctx.globalAlpha = 1
  }

  ctx.restore()
}
