'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Link2, Link2Off, RotateCcw, Crop } from 'lucide-react'
import ToolLayout from '@/components/tool-layout'
import { trackToolUsage } from '@/lib/track-tool-usage'

const presets = [
  {
    group: 'Etsy',
    options: [
      { label: 'Etsy Listing (2700×2025)', width: 2700, height: 2025 },
      { label: 'Etsy Thumbnail (1500×1200)', width: 1500, height: 1200 },
    ],
  },
  {
    group: 'Shopify',
    options: [
      { label: 'Shopify Product (2048×2048)', width: 2048, height: 2048 },
    ],
  },
  {
    group: 'Amazon',
    options: [
      { label: 'Amazon Main (2560×2560)', width: 2560, height: 2560 },
    ],
  },
  {
    group: 'Social Media',
    options: [
      { label: 'Instagram Post (1080×1080)', width: 1080, height: 1080 },
      { label: 'Facebook Share (1200×628)', width: 1200, height: 628 },
      { label: 'Twitter Banner (1500×500)', width: 1500, height: 500 },
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
      'Etsy recommends 2700×2025 pixels (4:3 ratio) for listing photos. Thumbnails should be at least 1500×1200 pixels.',
  },
  {
    question: 'Is there a file size limit?',
    answer:
      'No hard limit — images are processed entirely in your browser and never uploaded to a server.',
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

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

function Resizer({ file, onReset }: { file: File; onReset: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [originalWidth, setOriginalWidth] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lockAspect, setLockAspect] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se'
    startX: number
    startY: number
    startCrop: CropRect
  } | null>(null)
  const scaleRef = useRef(1)

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
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

  // Draw preview (non-crop mode)
  useEffect(() => {
    if (!image || !previewCanvasRef.current || cropMode) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxW = 480
    const maxH = 360
    const scale = Math.min(1, maxW / width, maxH / height)
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    if (crop) {
      // Draw the cropped region scaled to output dimensions
      ctx.drawImage(
        image,
        crop.x, crop.y, crop.w, crop.h,
        0, 0, canvas.width, canvas.height
      )
    } else {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
  }, [image, width, height, cropMode, crop])

  // Draw crop canvas
  const drawCropCanvas = useCallback(() => {
    if (!image || !cropCanvasRef.current || !crop) return
    const canvas = cropCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxW = 600
    const maxH = 450
    const scale = Math.min(1, maxW / originalWidth, maxH / originalHeight)
    scaleRef.current = scale
    canvas.width = Math.round(originalWidth * scale)
    canvas.height = Math.round(originalHeight * scale)

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Reveal crop region
    const cx = crop.x * scale
    const cy = crop.y * scale
    const cw = crop.w * scale
    const ch = crop.h * scale
    ctx.drawImage(
      image,
      crop.x, crop.y, crop.w, crop.h,
      cx, cy, cw, ch
    )

    // Border
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, cw, ch)

    // Corner handles
    const handleSize = 8
    ctx.fillStyle = '#3b82f6'
    const corners = [
      [cx, cy],
      [cx + cw, cy],
      [cx, cy + ch],
      [cx + cw, cy + ch],
    ]
    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize)
    }
  }, [image, crop, originalWidth, originalHeight])

  useEffect(() => {
    if (cropMode) drawCropCanvas()
  }, [cropMode, drawCropCanvas])

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
    if (!val) {
      // "Custom dimensions" selected — clear crop, restore original dimensions
      setCrop(null)
      setCropMode(false)
      if (image) {
        setWidth(originalWidth)
        setHeight(originalHeight)
      }
      return
    }
    const [pw, ph] = val.split('x').map(Number)
    setWidth(pw)
    setHeight(ph)

    // Initialize crop region at the preset's aspect ratio, centered, as large as possible
    const targetRatio = pw / ph
    let cropW: number, cropH: number
    if (originalWidth / originalHeight > targetRatio) {
      // Image is wider than target — constrain by height
      cropH = originalHeight
      cropW = Math.round(cropH * targetRatio)
    } else {
      // Image is taller than target — constrain by width
      cropW = originalWidth
      cropH = Math.round(cropW / targetRatio)
    }
    const cropX = Math.round((originalWidth - cropW) / 2)
    const cropY = Math.round((originalHeight - cropH) / 2)
    setCrop({ x: cropX, y: cropY, w: cropW, h: cropH })
    setCropMode(true)
  }

  const getHitTarget = (mx: number, my: number): 'move' | 'nw' | 'ne' | 'sw' | 'se' | null => {
    if (!crop) return null
    const scale = scaleRef.current
    const cx = crop.x * scale
    const cy = crop.y * scale
    const cw = crop.w * scale
    const ch = crop.h * scale
    const threshold = 12

    // Check corners first
    if (Math.abs(mx - cx) < threshold && Math.abs(my - cy) < threshold) return 'nw'
    if (Math.abs(mx - (cx + cw)) < threshold && Math.abs(my - cy) < threshold) return 'ne'
    if (Math.abs(mx - cx) < threshold && Math.abs(my - (cy + ch)) < threshold) return 'sw'
    if (Math.abs(mx - (cx + cw)) < threshold && Math.abs(my - (cy + ch)) < threshold) return 'se'

    // Check inside
    if (mx >= cx && mx <= cx + cw && my >= cy && my <= cy + ch) return 'move'
    return null
  }

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!crop || !cropCanvasRef.current) return
    const rect = cropCanvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const target = getHitTarget(mx, my)
    if (!target) return
    dragRef.current = { type: target, startX: mx, startY: my, startCrop: { ...crop } }
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropCanvasRef.current) return
    const rect = cropCanvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Update cursor
    const target = getHitTarget(mx, my)
    if (target === 'nw' || target === 'se') cropCanvasRef.current.style.cursor = 'nwse-resize'
    else if (target === 'ne' || target === 'sw') cropCanvasRef.current.style.cursor = 'nesw-resize'
    else if (target === 'move') cropCanvasRef.current.style.cursor = 'move'
    else cropCanvasRef.current.style.cursor = 'default'

    if (!dragRef.current || !crop) return
    const { type, startX, startY, startCrop } = dragRef.current
    const scale = scaleRef.current
    const dx = (mx - startX) / scale
    const dy = (my - startY) / scale

    // Maintain aspect ratio of the crop (matches output dimensions)
    const cropRatio = width / height

    if (type === 'move') {
      const newX = Math.max(0, Math.min(originalWidth - startCrop.w, startCrop.x + dx))
      const newY = Math.max(0, Math.min(originalHeight - startCrop.h, startCrop.y + dy))
      setCrop({ ...startCrop, x: Math.round(newX), y: Math.round(newY) })
    } else {
      let newW = startCrop.w
      let newH = startCrop.h
      let newX = startCrop.x
      let newY = startCrop.y

      if (type === 'se') {
        newW = Math.max(20, startCrop.w + dx)
        newH = newW / cropRatio
      } else if (type === 'sw') {
        newW = Math.max(20, startCrop.w - dx)
        newH = newW / cropRatio
        newX = startCrop.x + startCrop.w - newW
      } else if (type === 'ne') {
        newW = Math.max(20, startCrop.w + dx)
        newH = newW / cropRatio
        newY = startCrop.y + startCrop.h - newH
      } else if (type === 'nw') {
        newW = Math.max(20, startCrop.w - dx)
        newH = newW / cropRatio
        newX = startCrop.x + startCrop.w - newW
        newY = startCrop.y + startCrop.h - newH
      }

      // Clamp to image bounds
      newX = Math.max(0, newX)
      newY = Math.max(0, newY)
      newW = Math.min(newW, originalWidth - newX)
      newH = newW / cropRatio
      if (newY + newH > originalHeight) {
        newH = originalHeight - newY
        newW = newH * cropRatio
      }

      setCrop({
        x: Math.round(newX),
        y: Math.round(newY),
        w: Math.round(newW),
        h: Math.round(newH),
      })
    }
  }

  const handleCropMouseUp = () => {
    dragRef.current = null
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

      if (crop) {
        ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
      } else {
        ctx.drawImage(image, 0, 0, width, height)
      }

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
      {/* Preview / Crop Canvas */}
      <div className="flex justify-center bg-gray-100 rounded-lg p-4">
        {cropMode && crop ? (
          <canvas
            ref={cropCanvasRef}
            className="max-w-full rounded shadow cursor-crosshair"
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={handleCropMouseUp}
            onMouseLeave={handleCropMouseUp}
          />
        ) : (
          <canvas ref={previewCanvasRef} className="max-w-full rounded shadow" />
        )}
      </div>

      {/* Dimensions info */}
      <p className="text-sm text-gray-500 text-center">
        Original: {originalWidth}×{originalHeight}px → Output: {width}×{height}px
        {crop && (
          <span className="ml-2 text-blue-600">
            (cropping {crop.w}×{crop.h}px region)
          </span>
        )}
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

      {/* Crop toggle (when not using presets) */}
      {!cropMode && (
        <button
          onClick={() => {
            const targetRatio = width / height
            let cropW: number, cropH: number
            if (originalWidth / originalHeight > targetRatio) {
              cropH = originalHeight
              cropW = Math.round(cropH * targetRatio)
            } else {
              cropW = originalWidth
              cropH = Math.round(cropW / targetRatio)
            }
            setCrop({
              x: Math.round((originalWidth - cropW) / 2),
              y: Math.round((originalHeight - cropH) / 2),
              w: cropW,
              h: cropH,
            })
            setCropMode(true)
          }}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <Crop className="w-4 h-4" />
          Select crop region
        </button>
      )}

      {cropMode && (
        <button
          onClick={() => {
            setCropMode(false)
            setCrop(null)
          }}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <Crop className="w-4 h-4" />
          Remove crop (use full image)
        </button>
      )}

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
          {downloading ? 'Processing...' : `Download (${width}×${height})`}
        </button>
      </div>
    </div>
  )
}
