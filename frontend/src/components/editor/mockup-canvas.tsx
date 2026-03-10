'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { Point, OverlayConfig, getDefaultCorners, findClosestCorner, drawOverlay, drawPerspectivePreview } from '@/lib/canvas-utils'

interface MockupCanvasProps {
  imageUrl: string
  overlayConfig: OverlayConfig | null
  previewDesignUrl?: string
  onConfigChange: (config: OverlayConfig) => void
  mode: 'advanced' | 'basic'
}

export function MockupCanvas({ imageUrl, overlayConfig, previewDesignUrl, onConfigChange, mode }: MockupCanvasProps) {
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
        onConfigChange({ corners: defaultCorners, displacementIntensity: 0.5, mode })
      } else {
        setCorners(overlayConfig.corners)
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    if (!previewDesignUrl) return
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

    if (showPreview && designImage) {
      drawPerspectivePreview(ctx, image, designImage, corners, scale)
    } else {
      ctx.drawImage(image, 0, 0, image.width * scale, image.height * scale)
      drawOverlay(ctx, corners, null, scale)
    }
  }, [image, designImage, corners, scale, showPreview])

  useEffect(() => { render() }, [render])

  const getMousePos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
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
      onConfigChange({ corners, displacementIntensity: overlayConfig?.displacementIntensity ?? 0.5, mode })
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
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-crosshair rounded-lg border shadow-sm"
      />
    </div>
  )
}
