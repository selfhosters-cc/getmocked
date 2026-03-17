'use client'

import { useEffect, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
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

  const requiredWidth = Math.round(printWidth * desiredDpi)
  const requiredHeight = Math.round(printHeight * desiredDpi)

  const widthRatio = imgWidth / requiredWidth
  const heightRatio = imgHeight / requiredHeight

  const widthSufficient = widthRatio >= 1
  const widthMarginal = !widthSufficient && widthRatio >= 0.8
  const heightSufficient = heightRatio >= 1
  const heightMarginal = !heightSufficient && heightRatio >= 0.8

  const bothSufficient = widthSufficient && heightSufficient
  const anyMarginal =
    (!bothSufficient && (widthMarginal || heightMarginal)) &&
    !(!widthSufficient && !widthMarginal) &&
    !(!heightSufficient && !heightMarginal)

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

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const baseName = file.name.replace(/\.[^.]+$/, '')
      a.download = `${baseName}-${requiredWidth}x${requiredHeight}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      trackToolUsage('dpi')
    } finally {
      setResampling(false)
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
