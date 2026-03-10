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
      const maxWidth = 800
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      setCanvasSize({ width: w, height: h })
    }
    img.src = imageUrl
  }, [imageUrl])

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
      ctx.globalAlpha = 0.5
      ctx.fillStyle = stroke.mode === 'include' ? '#00ff00' : '#ff0000'
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

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = overlayCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskPath) return
    isDrawingRef.current = true
    currentStrokeRef.current = [getCanvasPoint(e)]
    drawBrushPreview(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawBrushPreview(e)
    if (!isDrawingRef.current) return
    const pt = getCanvasPoint(e)
    currentStrokeRef.current.push(pt)

    // Live preview of current stroke
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = brushMode === 'include' ? '#00ff00' : '#ff0000'
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, brushSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    if (currentStrokeRef.current.length > 0) {
      setStrokes((prev) => [
        ...prev,
        { points: currentStrokeRef.current, radius: brushSize, mode: brushMode },
      ])
      currentStrokeRef.current = []
    }
  }

  const drawBrushPreview = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
      ctx.globalAlpha = 0.5
      ctx.fillStyle = brushMode === 'include' ? '#00ff00' : '#ff0000'
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
      const result = await api.refineMask(setId, templateId, maskPath, strokes)
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
        className="relative border rounded bg-gray-100 inline-block"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      >
        <canvas
          ref={bgCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0"
        />
        <canvas
          ref={overlayCanvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute inset-0"
          style={{ cursor: maskPath ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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
