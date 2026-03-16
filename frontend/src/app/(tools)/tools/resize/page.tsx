'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Link2, Link2Off, RotateCcw } from 'lucide-react'
import ToolLayout from '@/components/tool-layout'
import { trackToolUsage } from '@/lib/track-tool-usage'

const presets = [
  {
    group: 'Etsy',
    options: [
      { label: 'Etsy Listing (2700\u00d72025)', width: 2700, height: 2025 },
      { label: 'Etsy Thumbnail (1500\u00d71200)', width: 1500, height: 1200 },
    ],
  },
  {
    group: 'Shopify',
    options: [
      { label: 'Shopify Product (2048\u00d72048)', width: 2048, height: 2048 },
    ],
  },
  {
    group: 'Amazon',
    options: [
      { label: 'Amazon Main (2560\u00d72560)', width: 2560, height: 2560 },
    ],
  },
  {
    group: 'Social Media',
    options: [
      { label: 'Instagram Post (1080\u00d71080)', width: 1080, height: 1080 },
      { label: 'Facebook Share (1200\u00d7628)', width: 1200, height: 628 },
      { label: 'Twitter Banner (1500\u00d7500)', width: 1500, height: 500 },
    ],
  },
]

const faq = [
  {
    question: 'What image formats are supported?',
    answer: 'PNG, JPG, WebP, and GIF images can be resized.',
  },
  {
    question: 'What size should Etsy listing photos be?',
    answer:
      'Etsy recommends 2700\u00d72025 pixels (4:3 ratio) for listing photos. Thumbnails should be at least 1500\u00d71200 pixels.',
  },
  {
    question: 'Is there a file size limit?',
    answer:
      'No hard limit \u2014 images are processed entirely in your browser and never uploaded to a server.',
  },
]

export default function ResizePage() {
  return (
    <ToolLayout
      title="Image Resizer"
      description="Resize images for Etsy, Shopify, Amazon, and social media with one click."
      faq={faq}
    >
      {({ files, clearFiles }) => <Resizer file={files[0]} onReset={clearFiles} />}
    </ToolLayout>
  )
}

function Resizer({ file, onReset }: { file: File; onReset: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [originalWidth, setOriginalWidth] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lockAspect, setLockAspect] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setOriginalWidth(img.naturalWidth)
      setOriginalHeight(img.naturalHeight)
      setWidth(img.naturalWidth)
      setHeight(img.naturalHeight)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Draw preview whenever image or dimensions change
  useEffect(() => {
    if (!image || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fit preview within a max box
    const maxW = 480
    const maxH = 360
    const scale = Math.min(1, maxW / width, maxH / height)
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  }, [image, width, height])

  const aspectRatio = originalWidth && originalHeight ? originalWidth / originalHeight : 1

  const handleWidthChange = useCallback(
    (newWidth: number) => {
      const w = Math.max(1, Math.round(newWidth))
      setWidth(w)
      if (lockAspect) {
        setHeight(Math.max(1, Math.round(w / aspectRatio)))
      }
    },
    [lockAspect, aspectRatio]
  )

  const handleHeightChange = useCallback(
    (newHeight: number) => {
      const h = Math.max(1, Math.round(newHeight))
      setHeight(h)
      if (lockAspect) {
        setWidth(Math.max(1, Math.round(h * aspectRatio)))
      }
    },
    [lockAspect, aspectRatio]
  )

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    const [pw, ph] = val.split('x').map(Number)
    setWidth(pw)
    setHeight(ph)
    // Selecting a preset disables aspect lock since presets have their own ratios
    setLockAspect(false)
  }

  const handleDownload = async () => {
    if (!image) return
    setDownloading(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const baseName = file.name.replace(/\.[^.]+$/, '')
      a.download = `${baseName}-${width}x${height}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      trackToolUsage('resize')
    } finally {
      setDownloading(false)
    }
  }

  if (!image) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div className="flex justify-center bg-gray-100 rounded-lg p-4">
        <canvas ref={previewCanvasRef} className="max-w-full rounded shadow" />
      </div>

      {/* Dimensions info */}
      <p className="text-sm text-gray-500 text-center">
        Original: {originalWidth}\u00d7{originalHeight}px &rarr; Resized: {width}\u00d7
        {height}px
      </p>

      {/* Preset selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Platform preset
        </label>
        <select
          onChange={handlePresetChange}
          defaultValue=""
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Custom dimensions</option>
          {presets.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.options.map((opt) => (
                <option key={opt.label} value={`${opt.width}x${opt.height}`}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Custom dimensions */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Width (px)
          </label>
          <input
            type="number"
            min={1}
            value={width}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => setLockAspect(!lockAspect)}
          className={`p-2 rounded-lg border transition-colors ${
            lockAspect
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-300 text-gray-400 hover:text-gray-600'
          }`}
          title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
        >
          {lockAspect ? <Link2 className="w-5 h-5" /> : <Link2Off className="w-5 h-5" />}
        </button>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Height (px)
          </label>
          <input
            type="number"
            min={1}
            value={height}
            onChange={(e) => handleHeightChange(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading || width < 1 || height < 1}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Processing...' : `Download (${width}\u00d7${height})`}
        </button>
      </div>
    </div>
  )
}
