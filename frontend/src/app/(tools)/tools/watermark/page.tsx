'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'
import JSZip from 'jszip'
import ToolLayout from '@/components/tool-layout'
import { useAuth } from '@/lib/auth-context'
import { trackToolUsage } from '@/lib/track-tool-usage'

const faq = [
  { question: 'Can I watermark multiple images at once?', answer: 'Yes! Upload multiple images and the watermark will be applied to all of them with the same settings.' },
  { question: 'What watermark types are supported?', answer: 'Text watermarks with customizable font size, color, and opacity. Image watermarks (like a logo) with adjustable opacity.' },
  { question: 'Where can I place the watermark?', answer: 'Choose from 9 positions (corners, edges, center) or tile the watermark across the entire image for maximum protection.' },
]

type Position =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'tiled'

const positionGrid: Position[][] = [
  ['top-left', 'top-center', 'top-right'],
  ['center-left', 'center', 'center-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
]

const positionLabels: Record<Position, string> = {
  'top-left': 'TL',
  'top-center': 'TC',
  'top-right': 'TR',
  'center-left': 'CL',
  'center': 'C',
  'center-right': 'CR',
  'bottom-left': 'BL',
  'bottom-center': 'BC',
  'bottom-right': 'BR',
  'tiled': 'Tiled',
}

export default function WatermarkPage() {
  const { user, loading } = useAuth()

  if (!user && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Watermark Tool</h1>
        <p className="text-gray-600 mb-8">Add text or image watermarks to multiple photos at once. Customizable position, opacity, and style.</p>
        <div className="bg-blue-50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Free Account Required</h2>
          <p className="text-gray-600 mb-4">Sign up for a free account to use this tool. No credit card required.</p>
          <Link href="/signup?redirect=%2Ftools%2Fwatermark" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
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
      title="Batch Watermark Tool"
      description="Add text or image watermarks to multiple photos at once with customizable position and opacity."
      multiple={true}
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <WatermarkTool files={files} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function getPositionXY(
  canvasW: number, canvasH: number, wmW: number, wmH: number, pos: Position
): [number, number] {
  const m = 10
  const positions: Record<string, [number, number]> = {
    'top-left': [m, m],
    'top-center': [(canvasW - wmW) / 2, m],
    'top-right': [canvasW - wmW - m, m],
    'center-left': [m, (canvasH - wmH) / 2],
    'center': [(canvasW - wmW) / 2, (canvasH - wmH) / 2],
    'center-right': [canvasW - wmW - m, (canvasH - wmH) / 2],
    'bottom-left': [m, canvasH - wmH - m],
    'bottom-center': [(canvasW - wmW) / 2, canvasH - wmH - m],
    'bottom-right': [canvasW - wmW - m, canvasH - wmH - m],
  }
  return positions[pos] || positions['center']
}

function WatermarkTool({ files, onReset }: { files: File[]; onReset: () => void }) {
  const [tab, setTab] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(24)
  const [color, setColor] = useState('#ffffff')
  const [opacity, setOpacity] = useState(50)
  const [position, setPosition] = useState<Position>('bottom-right')
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<{ name: string; blob: Blob; url: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const watermarkInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null)
  const [wmImg, setWmImg] = useState<HTMLImageElement | null>(null)

  // Load the first file as preview image
  useEffect(() => {
    if (!files[0]) return
    const url = URL.createObjectURL(files[0])
    const img = new window.Image()
    img.onload = () => setPreviewImage(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [files])

  // Load watermark image when selected
  useEffect(() => {
    if (!watermarkImage) { setWmImg(null); return }
    const url = URL.createObjectURL(watermarkImage)
    const img = new window.Image()
    img.onload = () => setWmImg(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [watermarkImage])

  // Draw preview
  useEffect(() => {
    if (!previewImage || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxW = 500
    const maxH = 375
    const scale = Math.min(1, maxW / previewImage.naturalWidth, maxH / previewImage.naturalHeight)
    const w = Math.round(previewImage.naturalWidth * scale)
    const h = Math.round(previewImage.naturalHeight * scale)
    canvas.width = w
    canvas.height = h

    // Draw base image
    ctx.drawImage(previewImage, 0, 0, w, h)

    const alpha = opacity / 100

    if (tab === 'text' && text.trim()) {
      const scaledFontSize = Math.round(fontSize * scale)
      const [r, g, b] = hexToRgb(color)
      ctx.font = `${scaledFontSize}px sans-serif`
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
      ctx.textBaseline = 'top'

      const metrics = ctx.measureText(text)
      const textW = metrics.width
      const textH = scaledFontSize

      if (position === 'tiled') {
        for (let ty = 0; ty < h; ty += textH + 40) {
          for (let tx = 0; tx < w; tx += textW + 40) {
            ctx.fillText(text, tx, ty)
          }
        }
      } else {
        const [tx, ty] = getPositionXY(w, h, textW, textH, position)
        ctx.fillText(text, tx, ty)
      }
    } else if (tab === 'image' && wmImg) {
      // Scale watermark to max 30% of canvas width
      const maxWmW = w * 0.3
      let wmW = wmImg.naturalWidth * scale
      let wmH = wmImg.naturalHeight * scale
      if (wmW > maxWmW) {
        const ratio = maxWmW / wmW
        wmW = maxWmW
        wmH = wmH * ratio
      }

      ctx.globalAlpha = alpha

      if (position === 'tiled') {
        for (let ty = 0; ty < h; ty += wmH + 30) {
          for (let tx = 0; tx < w; tx += wmW + 30) {
            ctx.drawImage(wmImg, tx, ty, wmW, wmH)
          }
        }
      } else {
        const [px, py] = getPositionXY(w, h, wmW, wmH, position)
        ctx.drawImage(wmImg, px, py, wmW, wmH)
      }
      ctx.globalAlpha = 1
    }
  }, [previewImage, wmImg, tab, text, fontSize, color, opacity, position])

  const handleApply = useCallback(async () => {
    if (tab === 'text' && !text.trim()) return
    if (tab === 'image' && !watermarkImage) return

    setProcessing(true)
    setError(null)
    // Clean up old results
    for (const r of results) URL.revokeObjectURL(r.url)
    setResults([])
    setProgress({ current: 0, total: files.length })

    const newResults: { name: string; blob: Blob; url: string }[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length })

        const formData = new FormData()
        formData.append('image', files[i])
        formData.append('position', position)
        formData.append('opacity', opacity.toString())

        if (tab === 'text') {
          formData.append('type', 'text')
          formData.append('text', text)
          formData.append('font_size', fontSize.toString())
          formData.append('color', color)
        } else {
          formData.append('type', 'image')
          formData.append('watermark_image', watermarkImage!)
        }

        const res = await fetch('/api/tools/watermark', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Processing failed' }))
          throw new Error(data.error || `Failed to process ${files[i].name}`)
        }

        const blob = await res.blob()
        const baseName = files[i].name.replace(/\.[^.]+$/, '')
        newResults.push({
          name: `${baseName}-watermarked.png`,
          blob,
          url: URL.createObjectURL(blob),
        })
      }

      setResults(newResults)
      trackToolUsage('watermark')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      // Keep partial results
      setResults(newResults)
    } finally {
      setProcessing(false)
    }
  }, [files, tab, text, fontSize, color, opacity, position, watermarkImage, results])

  const handleDownloadSingle = (result: { name: string; url: string }) => {
    const a = document.createElement('a')
    a.href = result.url
    a.download = result.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleDownloadAll = async () => {
    if (results.length === 0) return
    const zip = new JSZip()
    for (const r of results) {
      zip.file(r.name, r.blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'watermarked-images.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    for (const r of results) URL.revokeObjectURL(r.url)
    setResults([])
    setError(null)
    setWatermarkImage(null)
    onReset()
  }

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('text')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'text'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Text Watermark
          </button>
          <button
            onClick={() => setTab('image')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'image'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Image Watermark
          </button>
        </div>
      </div>

      {/* Text watermark options */}
      {tab === 'text' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Watermark Text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter watermark text..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Font Size: {fontSize}px
            </label>
            <input
              type="range"
              min={12}
              max={200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            />
            <span className="text-sm text-gray-500">{color}</span>
          </div>
        </div>
      )}

      {/* Image watermark options */}
      {tab === 'image' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Watermark Image</label>
          {watermarkImage ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{watermarkImage.name}</span>
              <button
                onClick={() => setWatermarkImage(null)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => watermarkInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 transition-colors w-full justify-center"
            >
              <Upload className="w-4 h-4" />
              Upload watermark image
            </button>
          )}
          <input
            ref={watermarkInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setWatermarkImage(f)
              if (watermarkInputRef.current) watermarkInputRef.current.value = ''
            }}
            className="hidden"
          />
        </div>
      )}

      {/* Opacity slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Opacity: {opacity}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </div>

      {/* Position grid */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
        <div className="inline-flex flex-col gap-1">
          {positionGrid.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosition(pos)}
                  className={`w-10 h-10 rounded text-xs font-medium transition-colors ${
                    position === pos
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={pos}
                >
                  {positionLabels[pos]}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2">
          <button
            onClick={() => setPosition('tiled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              position === 'tiled'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tiled
          </button>
        </div>
      </div>

      {/* Live preview */}
      {previewImage && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
          <div className="bg-gray-100 rounded-lg p-3 flex justify-center">
            <canvas ref={previewCanvasRef} className="rounded shadow max-w-full" />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Preview of first image. Adjust settings above — preview updates live.
          </p>
        </div>
      )}

      {/* File count */}
      <p className="text-sm text-gray-500">
        {files.length} image{files.length !== 1 ? 's' : ''} selected
      </p>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={processing || (tab === 'text' && !text.trim()) || (tab === 'image' && !watermarkImage)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing {progress.current}/{progress.total}...
          </>
        ) : (
          'Apply Watermark'
        )}
      </button>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Results ({results.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((r, i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={r.name} className="max-h-40 mx-auto rounded" />
                <p className="text-xs text-gray-500 mt-1 truncate">{r.name}</p>
                <button
                  onClick={() => handleDownloadSingle(r)}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
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
        {results.length > 1 && (
          <button
            onClick={handleDownloadAll}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download All as ZIP
          </button>
        )}
        {results.length === 1 && (
          <button
            onClick={() => handleDownloadSingle(results[0])}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        )}
      </div>
    </div>
  )
}
