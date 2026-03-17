'use client'

import { useEffect, useState } from 'react'
import { Download, RotateCcw, ArrowLeft } from 'lucide-react'
import ToolLayout from '@/components/tool-layout'
import { trackToolUsage } from '@/lib/track-tool-usage'

const printPresets = [
  { label: '4x6" (Postcard)', width: 4, height: 6 },
  { label: '8x10" (Print)', width: 8, height: 10 },
  { label: '11x14" (Poster)', width: 11, height: 14 },
  { label: '16x20" (Large)', width: 16, height: 20 },
]

const faq = [
  { question: 'What DPI do I need for print?', answer: '300 DPI is the standard for high-quality prints. 150 DPI is acceptable for larger formats like posters.' },
  { question: 'How do I check my image DPI?', answer: 'Upload your image and enter the DPI it was created at (usually 72 for web, 300 for print). The tool calculates if it is sufficient for your target print size.' },
  { question: 'What happens when I resample?', answer: 'Resampling changes the pixel dimensions of your image. Upsampling (making bigger) may reduce sharpness. Downsampling (making smaller) is generally safe.' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ZoomComparison({
  originalUrl,
  compressedUrl,
  originalSize,
  compressedSize,
  originalLabel,
  compressedLabel,
}: {
  originalUrl: string
  compressedUrl: string
  originalSize: number
  compressedSize: number
  originalLabel?: string
  compressedLabel?: string
}) {
  const [zoom, setZoom] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 })
  const zoomLevel = 3

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setZoomPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
  }

  const imageStyle = zoom
    ? {
        transform: `scale(${zoomLevel})`,
        transformOrigin: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
        transition: 'transform-origin 0.1s ease-out',
      }
    : {}

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div
          className="bg-gray-100 rounded-lg p-2 text-center overflow-hidden cursor-zoom-in"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => setZoom(false)}
          onMouseMove={handleMouseMove}
        >
          <p className="text-xs text-gray-500 mb-2">{originalLabel || 'Original'}</p>
          <div className="overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={originalUrl} alt="Original" className="max-h-64 mx-auto" style={imageStyle} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{formatSize(originalSize)}</p>
        </div>
        <div
          className="bg-gray-100 rounded-lg p-2 text-center overflow-hidden cursor-zoom-in"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => setZoom(false)}
          onMouseMove={handleMouseMove}
        >
          <p className="text-xs text-gray-500 mb-2">{compressedLabel || 'Resampled'}</p>
          <div className="overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={compressedUrl} alt="Resampled" className="max-h-64 mx-auto" style={imageStyle} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{formatSize(compressedSize)}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-1">Hover to zoom and compare</p>
    </div>
  )
}

export default function DpiPage() {
  return (
    <ToolLayout
      title="DPI Checker / Converter"
      description="Check if your image resolution is sufficient for print. Calculate required pixels for any print size and DPI."
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <DpiChecker file={files[0]} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function DpiChecker({
  file,
  onReset,
}: {
  file: File
  onReset: () => void
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imgWidth, setImgWidth] = useState(0)
  const [imgHeight, setImgHeight] = useState(0)
  const [currentDpi, setCurrentDpi] = useState(72)
  const [desiredDpi, setDesiredDpi] = useState(300)
  const [printWidth, setPrintWidth] = useState(8)
  const [printHeight, setPrintHeight] = useState(10)
  const [resampling, setResampling] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resampledUrl, setResampledUrl] = useState<string | null>(null)
  const [resampledBlob, setResampledBlob] = useState<Blob | null>(null)

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setImgWidth(img.naturalWidth)
      setImgHeight(img.naturalHeight)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Create preview URL
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const requiredWidth = Math.round(printWidth * desiredDpi)
  const requiredHeight = Math.round(printHeight * desiredDpi)

  const widthRatio = imgWidth / requiredWidth
  const heightRatio = imgHeight / requiredHeight

  const widthSufficient = widthRatio >= 1
  const widthMarginal = !widthSufficient && widthRatio >= 0.8
  const heightSufficient = heightRatio >= 1
  const heightMarginal = !heightSufficient && heightRatio >= 0.8

  const bothSufficient = widthSufficient && heightSufficient

  // Overall status: green if both sufficient, yellow if marginal, red otherwise
  let statusColor: 'green' | 'yellow' | 'red' = 'red'
  if (bothSufficient) statusColor = 'green'
  else if (
    (widthSufficient || widthMarginal) &&
    (heightSufficient || heightMarginal)
  )
    statusColor = 'yellow'

  const statusBg = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
  }[statusColor]

  const statusText = {
    green: 'text-green-800',
    yellow: 'text-yellow-800',
    red: 'text-red-800',
  }[statusColor]

  const currentPrintWidth = imgWidth / currentDpi
  const currentPrintHeight = imgHeight / currentDpi

  const handlePreset = (w: number, h: number) => {
    setPrintWidth(w)
    setPrintHeight(h)
  }

  const handleResample = async () => {
    if (!image) return
    setResampling(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = requiredWidth
      canvas.height = requiredHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, 0, 0, requiredWidth, requiredHeight)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) return

      // Clean up previous resampled URL
      if (resampledUrl) URL.revokeObjectURL(resampledUrl)

      const url = URL.createObjectURL(blob)
      setResampledUrl(url)
      setResampledBlob(blob)
    } finally {
      setResampling(false)
    }
  }

  const handleDownloadResampled = () => {
    if (!resampledUrl) return
    const a = document.createElement('a')
    a.href = resampledUrl
    const baseName = file.name.replace(/\.[^.]+$/, '')
    a.download = `${baseName}-${requiredWidth}x${requiredHeight}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    trackToolUsage('dpi')
  }

  const handleBackFromResampled = () => {
    if (resampledUrl) URL.revokeObjectURL(resampledUrl)
    setResampledUrl(null)
    setResampledBlob(null)
  }

  if (!image) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  // Show resampled comparison view
  if (resampledUrl && resampledBlob && previewUrl) {
    return (
      <div className="space-y-6">
        <h2 className="text-sm font-medium text-gray-700">
          Resampled Result: {requiredWidth}&times;{requiredHeight}px at {desiredDpi} DPI
        </h2>

        <ZoomComparison
          originalUrl={previewUrl}
          compressedUrl={resampledUrl}
          originalSize={file.size}
          compressedSize={resampledBlob.size}
          originalLabel={`Original (${imgWidth}\u00d7${imgHeight})`}
          compressedLabel={`Resampled (${requiredWidth}\u00d7${requiredHeight})`}
        />

        <div className="flex gap-3">
          <button
            onClick={handleBackFromResampled}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleDownloadResampled}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Resampled
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Image info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Image Info</h2>
        <p className="text-lg font-semibold text-gray-900">
          {imgWidth} &times; {imgHeight} px
        </p>
        <p className="text-sm text-gray-500 mt-1">
          At {currentDpi} DPI: {currentPrintWidth.toFixed(1)}&quot; &times;{' '}
          {currentPrintHeight.toFixed(1)}&quot;
        </p>
      </div>

      {/* Image preview */}
      {previewUrl && (
        <div className="flex justify-center bg-gray-100 rounded-lg p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Uploaded image" className="max-h-48 rounded" />
        </div>
      )}

      {/* DPI inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current DPI
          </label>
          <input
            type="number"
            min={1}
            value={currentDpi}
            onChange={(e) => setCurrentDpi(Math.max(1, Number(e.target.value)))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Desired DPI
          </label>
          <input
            type="number"
            min={1}
            value={desiredDpi}
            onChange={(e) => setDesiredDpi(Math.max(1, Number(e.target.value)))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Print size presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Print Size Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {printPresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.width, preset.height)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                printWidth === preset.width && printHeight === preset.height
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom print size */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Print Width (inches)
          </label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={printWidth}
            onChange={(e) => setPrintWidth(Math.max(0.1, Number(e.target.value)))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Print Height (inches)
          </label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={printHeight}
            onChange={(e) => setPrintHeight(Math.max(0.1, Number(e.target.value)))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Sufficiency indicator */}
      <div className={`rounded-lg border p-4 ${statusBg}`}>
        <p className={`text-sm font-medium ${statusText} mb-2`}>
          Your image is {imgWidth}&times;{imgHeight}px. At {desiredDpi} DPI, you
          need {requiredWidth}&times;{requiredHeight}px for a {printWidth}&times;
          {printHeight}&quot; print.
        </p>
        <div className="space-y-1">
          <p className={`text-sm ${statusText}`}>
            {widthSufficient ? '\u2713' : widthMarginal ? '\u26A0' : '\u2717'}{' '}
            Width: {imgWidth}px {widthSufficient ? 'is sufficient' : widthMarginal ? 'is marginal (within 80%)' : 'is insufficient'} (need {requiredWidth}px)
          </p>
          <p className={`text-sm ${statusText}`}>
            {heightSufficient ? '\u2713' : heightMarginal ? '\u26A0' : '\u2717'}{' '}
            Height: {imgHeight}px {heightSufficient ? 'is sufficient' : heightMarginal ? 'is marginal (within 80%)' : 'is insufficient'} (need {requiredHeight}px)
          </p>
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
          onClick={handleResample}
          disabled={resampling}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          {resampling
            ? 'Resampling...'
            : `Resample to ${requiredWidth}\u00d7${requiredHeight}px`}
        </button>
      </div>
    </div>
  )
}
