'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Download, RotateCcw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ToolLayout from '@/components/tool-layout'
import { useAuth } from '@/lib/auth-context'
import { trackToolUsage } from '@/lib/track-tool-usage'

const faq = [
  { question: 'How does background removal work?', answer: 'White mode removes light-colored backgrounds using a brightness threshold. Contour mode detects the largest object and removes everything else.' },
  { question: 'Can I adjust the sensitivity?', answer: 'Yes. The threshold slider controls how aggressive the removal is. Higher values remove only very light pixels, lower values remove more.' },
  { question: 'What format is the output?', answer: 'PNG with transparency. The removed background becomes transparent.' },
]

export default function BackgroundRemoverPage() {
  const { user, loading } = useAuth()

  if (!user && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Background Remover</h1>
        <p className="text-gray-600 mb-8">Remove backgrounds from product photos instantly. White background removal and contour detection modes.</p>
        <div className="bg-blue-50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Free Account Required</h2>
          <p className="text-gray-600 mb-4">Sign up for a free account to use this tool. No credit card required.</p>
          <Link href="/signup?redirect=%2Ftools%2Fbackground-remover" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
            Sign Up Free
          </Link>
        </div>
        {faq.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{item.question}</h3>
                  <p className="text-sm text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
      </div>
    )
  }

  return (
    <ToolLayout
      title="Background Remover"
      description="Remove backgrounds from product photos. Choose white background or contour detection mode."
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <BackgroundRemoverTool file={files[0]} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function BackgroundRemoverTool({ file, onReset }: { file: File; onReset: () => void }) {
  const [mode, setMode] = useState<'white' | 'contour'>('white')
  const [threshold, setThreshold] = useState(240)
  const [processing, setProcessing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null)
  const [brushMode, setBrushMode] = useState<'include' | 'exclude'>('include')
  const [brushSize, setBrushSize] = useState(20)
  const [painting, setPainting] = useState(false)
  const [strokes, setStrokes] = useState<Array<{points: {x: number, y: number}[], radius: number, mode: string}>>([])
  const [currentStroke, setCurrentStroke] = useState<{x: number, y: number}[]>([])
  const [refining, setRefining] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)

  const handleRemove = async () => {
    setProcessing(true)
    setError(null)
    setResultUrl(null)
    setMaskBlob(null)
    setStrokes([])
    setCurrentStroke([])

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('threshold', threshold.toString())
      formData.append('mode', mode)

      const res = await fetch('/api/tools/background-remove', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Processing failed' }))
        throw new Error(data.error || 'Processing failed')
      }

      const blob = await res.blob()
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(URL.createObjectURL(blob))

      const maskB64 = res.headers.get('X-Mask-Data')
      if (maskB64) {
        const maskBytes = Uint8Array.from(atob(maskB64), c => c.charCodeAt(0))
        setMaskBlob(new Blob([maskBytes], { type: 'image/png' }))
      }

      trackToolUsage('background-remove')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    const baseName = file.name.replace(/\.[^.]+$/, '')
    a.download = `${baseName}-no-bg.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleReset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
    setError(null)
    setMaskBlob(null)
    setStrokes([])
    setCurrentStroke([])
    onReset()
  }

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = scaleRef.current
    return {
      x: Math.round((e.clientX - rect.left) / scale),
      y: Math.round((e.clientY - rect.top) / scale),
    }
  }

  const drawStrokePoint = useCallback((pt: {x: number, y: number}) => {
    const ctx = overlayCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const scale = scaleRef.current
    ctx.fillStyle = brushMode === 'include' ? 'rgba(0, 200, 0, 0.4)' : 'rgba(200, 0, 0, 0.4)'
    ctx.beginPath()
    ctx.arc(pt.x * scale, pt.y * scale, brushSize * scale, 0, Math.PI * 2)
    ctx.fill()
  }, [brushMode, brushSize])

  const drawStrokeLine = useCallback((from: {x: number, y: number}, to: {x: number, y: number}) => {
    const ctx = overlayCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const scale = scaleRef.current
    ctx.strokeStyle = brushMode === 'include' ? 'rgba(0, 200, 0, 0.4)' : 'rgba(200, 0, 0, 0.4)'
    ctx.lineWidth = brushSize * 2 * scale
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x * scale, from.y * scale)
    ctx.lineTo(to.x * scale, to.y * scale)
    ctx.stroke()
  }, [brushMode, brushSize])

  const handlePaintStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e)
    setCurrentStroke([pt])
    setPainting(true)
    drawStrokePoint(pt)
  }

  const handlePaintMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!painting) return
    const pt = getCanvasCoords(e)
    setCurrentStroke(prev => {
      const lastPt = prev[prev.length - 1] || pt
      drawStrokeLine(lastPt, pt)
      return [...prev, pt]
    })
  }

  const handlePaintEnd = () => {
    if (!painting || currentStroke.length === 0) return
    setPainting(false)
    setStrokes(prev => [...prev, {
      points: currentStroke,
      radius: brushSize,
      mode: brushMode,
    }])
    setCurrentStroke([])
  }

  const redrawOverlay = useCallback(() => {
    const ctx = overlayCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const canvas = overlayCanvasRef.current!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const scale = scaleRef.current
    for (const stroke of strokes) {
      ctx.strokeStyle = stroke.mode === 'include' ? 'rgba(0, 200, 0, 0.4)' : 'rgba(200, 0, 0, 0.4)'
      ctx.fillStyle = stroke.mode === 'include' ? 'rgba(0, 200, 0, 0.4)' : 'rgba(200, 0, 0, 0.4)'
      ctx.lineWidth = stroke.radius * 2 * scale
      ctx.lineCap = 'round'
      if (stroke.points.length === 1) {
        ctx.beginPath()
        ctx.arc(stroke.points[0].x * scale, stroke.points[0].y * scale, stroke.radius * scale, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale)
        }
        ctx.stroke()
      }
    }
  }, [strokes])

  const handleRefine = async () => {
    if (!maskBlob || strokes.length === 0) return
    setRefining(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('mask', maskBlob, 'mask.png')
      formData.append('strokes', JSON.stringify(strokes))

      const res = await fetch('/api/tools/background-refine', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) throw new Error('Refinement failed')

      const blob = await res.blob()
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(URL.createObjectURL(blob))

      const maskB64 = res.headers.get('X-Mask-Data')
      if (maskB64) {
        const maskBytes = Uint8Array.from(atob(maskB64), c => c.charCodeAt(0))
        setMaskBlob(new Blob([maskBytes], { type: 'image/png' }))
      }

      setStrokes([])
      setCurrentStroke([])
      const ctx = overlayCanvasRef.current?.getContext('2d')
      if (ctx && overlayCanvasRef.current) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    } finally {
      setRefining(false)
    }
  }

  // Draw result image on canvas when resultUrl changes
  useEffect(() => {
    if (!resultUrl || !canvasRef.current) return
    const img = new window.Image()
    img.onload = () => {
      imageRef.current = img
      const maxW = 600
      const maxH = 450
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
      scaleRef.current = scale

      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)

      canvasRef.current!.width = w
      canvasRef.current!.height = h
      overlayCanvasRef.current!.width = w
      overlayCanvasRef.current!.height = h

      const ctx = canvasRef.current!.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)

      const octx = overlayCanvasRef.current!.getContext('2d')!
      octx.clearRect(0, 0, w, h)
    }
    img.src = resultUrl
  }, [resultUrl])

  // Redraw overlay when strokes change (for undo)
  useEffect(() => {
    redrawOverlay()
  }, [redrawOverlay])

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('white')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'white'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            White Background
          </button>
          <button
            onClick={() => setMode('contour')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'contour'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Contour Detection
          </button>
        </div>
      </div>

      {/* Threshold slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Threshold: {threshold}
        </label>
        <input
          type="range"
          min={200}
          max={255}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>More aggressive</span>
          <span>Less aggressive</span>
        </div>
      </div>

      {/* Process button */}
      <button
        onClick={handleRemove}
        disabled={processing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Remove Background'
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Result with paint-to-refine UI */}
      {resultUrl && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Result — paint to refine
          </h2>

          {/* Brush controls */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setBrushMode('include')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  brushMode === 'include'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Keep (Object)
              </button>
              <button
                onClick={() => setBrushMode('exclude')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  brushMode === 'exclude'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Remove (Background)
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Brush:</label>
              <input
                type="range"
                min={5}
                max={50}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24 accent-blue-600"
              />
              <span className="text-xs text-gray-500 w-6">{brushSize}</span>
            </div>
          </div>

          {/* Canvas container */}
          <div
            className="relative rounded-lg overflow-hidden inline-block"
            style={{
              backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)',
              backgroundSize: '20px 20px',
            }}
          >
            <canvas ref={canvasRef} />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0"
              style={{ cursor: 'crosshair' }}
              onMouseDown={handlePaintStart}
              onMouseMove={handlePaintMove}
              onMouseUp={handlePaintEnd}
              onMouseLeave={handlePaintEnd}
            />
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Paint green to keep areas, red to remove. Then click &quot;Apply Refinement&quot;.
          </p>
        </div>
      )}

      {/* Refinement action buttons */}
      {resultUrl && maskBlob && (
        <div className="flex gap-2">
          {strokes.length > 0 && (
            <>
              <button
                onClick={() => {
                  setStrokes(prev => prev.slice(0, -1))
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Undo
              </button>
              <button
                onClick={handleRefine}
                disabled={refining}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {refining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refining...
                  </>
                ) : (
                  'Apply Refinement'
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        {resultUrl && (
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
        )}
      </div>
    </div>
  )
}
