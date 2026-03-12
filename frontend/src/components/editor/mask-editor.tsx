'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'

interface MaskEditorProps {
  setId: string
  templateId: string
  imageUrl: string
  onMaskReady?: (maskPath: string) => void
}

interface StrokePoint {
  x: number
  y: number
}

interface Stroke {
  points: StrokePoint[]
  radius: number
  mode: 'include' | 'exclude'
}

export function MaskEditor({ setId, templateId, imageUrl, onMaskReady }: MaskEditorProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const templateImageRef = useRef<HTMLImageElement | null>(null)

  const [maskPath, setMaskPath] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [brushMode, setBrushMode] = useState<'include' | 'exclude'>('include')
  const [brushSize, setBrushSize] = useState(20)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [maskLoaded, setMaskLoaded] = useState(0)

  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<StrokePoint[]>([])
  const maskImageRef = useRef<HTMLImageElement | null>(null)

  // Load template image and set canvas size
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      templateImageRef.current = img
      const containerWidth = containerRef.current?.clientWidth ?? 800
      const scale = Math.min(1, containerWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      setCanvasSize({ width: w, height: h })
    }
    img.src = imageUrl
  }, [imageUrl])

  // Recalculate canvas size when container resizes
  useEffect(() => {
    if (!containerRef.current || !templateImageRef.current) return
    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      const img = templateImageRef.current!
      const scale = Math.min(1, width / img.width)
      setCanvasSize({ width: Math.round(img.width * scale), height: Math.round(img.height * scale) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.width > 0])

  // Draw background image when canvas size is ready
  useEffect(() => {
    if (!canvasSize.width || !canvasSize.height) return
    const bgCanvas = bgCanvasRef.current
    if (!bgCanvas) return
    const ctx = bgCanvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
      ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height)
    }
    img.src = imageUrl
  }, [imageUrl, canvasSize])

  const drawMaskOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    // Draw mask as green overlay
    if (maskImageRef.current) {
      ctx.save()
      ctx.globalAlpha = 0.4
      ctx.drawImage(maskImageRef.current, 0, 0, canvasSize.width, canvasSize.height)

      // Tint green: draw green rect, then use mask as composite
      // Simpler approach: draw mask, then composite green on top
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = '#00ff00'
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)
      ctx.restore()
    }

    // Draw accumulated strokes as preview
    for (const stroke of strokes) {
      if (stroke.points.length < 1) continue
      ctx.save()
      if (stroke.mode === 'exclude') {
        // Erase the green overlay to show the product photo underneath
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.4
      }
      ctx.fillStyle = stroke.mode === 'include' ? '#00ff00' : '#000000'
      for (const pt of stroke.points) {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, stroke.radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }, [canvasSize, strokes, maskLoaded])

  useEffect(() => {
    drawMaskOverlay()
  }, [drawMaskOverlay])

  const loadMask = useCallback((maskRelPath: string) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      maskImageRef.current = img
      setMaskLoaded((n) => n + 1)
    }
    // Add cache buster to reload after refinement
    img.src = `/uploads/${maskRelPath}?t=${Date.now()}`
  }, [])

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): StrokePoint => {
    const canvas = overlayCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? e.changedTouches[0].clientX) : e.clientX
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? e.changedTouches[0].clientY) : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!maskPath) return
    isDrawingRef.current = true
    currentStrokeRef.current = [getCanvasPoint(e)]
    if (!('touches' in e)) {
      drawBrushPreview(e as React.MouseEvent)
    }
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!('touches' in e)) {
      drawBrushPreview(e as React.MouseEvent)
    }
    if (!isDrawingRef.current) return
    const pt = getCanvasPoint(e)
    currentStrokeRef.current.push(pt)

    // Live preview of current stroke
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    if (brushMode === 'exclude') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = 1
      ctx.fillStyle = '#000000'
    } else {
      ctx.globalAlpha = 0.4
      ctx.fillStyle = '#00ff00'
    }
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, brushSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    if (currentStrokeRef.current.length > 0) {
      // Capture points before clearing — setStrokes callback runs async (React batching)
      // and would read the already-cleared ref otherwise
      const completedPoints = currentStrokeRef.current
      currentStrokeRef.current = []
      setStrokes((prev) => [
        ...prev,
        { points: completedPoints, radius: brushSize, mode: brushMode },
      ])
    }
  }

  const drawBrushPreview = (e: React.MouseEvent) => {
    if (!maskPath) return
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Redraw overlay then cursor
    drawMaskOverlay()

    // Draw current in-progress stroke
    if (isDrawingRef.current && currentStrokeRef.current.length > 0) {
      ctx.save()
      if (brushMode === 'exclude') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1
        ctx.fillStyle = '#000000'
      } else {
        ctx.globalAlpha = 0.4
        ctx.fillStyle = '#00ff00'
      }
      for (const pt of currentStrokeRef.current) {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, brushSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Brush cursor
    const pt = getCanvasPoint(e)
    ctx.save()
    ctx.strokeStyle = brushMode === 'include' ? '#00ff00' : '#ff0000'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, brushSize, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const result = await api.detectMask(setId, templateId)
      setMaskPath(result.maskPath)
      loadMask(result.maskPath)
      onMaskReady?.(result.maskPath)
    } catch (err) {
      console.error('Mask detection failed:', err)
    } finally {
      setDetecting(false)
    }
  }

  const handleSaveRefinement = async () => {
    if (!maskPath || strokes.length === 0) return
    setSaving(true)
    try {
      // Scale stroke coordinates from canvas space to original image space
      const origW = templateImageRef.current?.naturalWidth ?? canvasSize.width
      const scaleFactor = origW / canvasSize.width
      const scaledStrokes = strokes.map((s) => ({
        ...s,
        radius: Math.round(s.radius * scaleFactor),
        points: s.points.map((p) => ({
          x: Math.round(p.x * scaleFactor),
          y: Math.round(p.y * scaleFactor),
        })),
      }))
      const result = await api.refineMask(setId, templateId, maskPath, scaledStrokes)
      setStrokes([])
      const newPath = result.maskPath || maskPath
      setMaskPath(newPath)
      loadMask(newPath)
      onMaskReady?.(newPath)
    } catch (err) {
      console.error('Mask refinement failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!canvasSize.width) return <div className="text-sm text-gray-500">Loading image...</div>

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDetect}
          disabled={detecting}
          className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {detecting ? 'Detecting...' : maskPath ? 'Re-detect Product' : 'Detect Product'}
        </button>

        {maskPath && (
          <>
            <div className="flex items-center gap-1 border rounded px-1">
              <button
                onClick={() => setBrushMode('include')}
                className={`px-2 py-1 text-xs rounded ${
                  brushMode === 'include' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Include
              </button>
              <button
                onClick={() => setBrushMode('exclude')}
                className={`px-2 py-1 text-xs rounded ${
                  brushMode === 'exclude' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Exclude
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <label className="text-gray-600">Brush:</label>
              <input
                type="range"
                min={5}
                max={50}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-gray-500 w-8">{brushSize}px</span>
            </div>

            <button
              onClick={handleSaveRefinement}
              disabled={saving || strokes.length === 0}
              className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Refinement'}
            </button>

            {strokes.length > 0 && (
              <button
                onClick={() => {
                  setStrokes([])
                  drawMaskOverlay()
                }}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear strokes
              </button>
            )}
          </>
        )}
      </div>

      {/* Canvas layers */}
      <div
        ref={containerRef}
        className="relative border rounded bg-gray-100 w-full max-w-[800px]"
        style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
      >
        <canvas
          ref={bgCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0 w-full h-full"
        />
        <canvas
          ref={overlayCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: maskPath ? 'crosshair' : 'default', touchAction: 'none' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={(e) => { e.preventDefault(); handlePointerDown(e) }}
          onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e) }}
          onTouchEnd={handlePointerUp}
        />
      </div>

      {!maskPath && (
        <p className="text-xs text-gray-400">
          Click &quot;Detect Product&quot; to auto-detect the product region. You can then refine the mask with brush strokes.
        </p>
      )}
    </div>
  )
}
