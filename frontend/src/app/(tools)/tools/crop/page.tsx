'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import ToolLayout from '@/components/tool-layout'
import { trackToolUsage } from '@/lib/track-tool-usage'

const HANDLE_SIZE = 8
const MAX_CANVAS_WIDTH = 600

const aspectRatios = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
] as const

const faq = [
  {
    question: 'What aspect ratios are available?',
    answer:
      'Free crop, 1:1 (square), 4:3, 3:2, and 16:9. You can also drag freely for any custom crop.',
  },
  {
    question: 'Is my image uploaded to a server?',
    answer:
      'No. All cropping happens entirely in your browser. Your images never leave your device.',
  },
  {
    question: 'What formats can I crop?',
    answer: 'PNG, JPG, WebP, and GIF images are supported.',
  },
]

type CropRect = { x: number; y: number; width: number; height: number }
type DragMode =
  | null
  | 'move'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'n'
  | 's'
  | 'e'
  | 'w'

export default function CropPage() {
  return (
    <ToolLayout
      title="Image Cropper"
      description="Crop images with preset aspect ratios for e-commerce listings and social media."
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <Cropper file={files[0]} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function Cropper({ file, onReset }: { file: File; onReset: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 })
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragModeRef = useRef<DragMode>(null)
  const dragStartRef = useRef<{ mx: number; my: number; crop: CropRect }>({
    mx: 0,
    my: 0,
    crop: { x: 0, y: 0, width: 0, height: 0 },
  })

  // Scale factor: display pixels -> original image pixels
  const scaleRef = useRef(1)

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      // Initialize crop to 80% centered
      const cw = Math.round(img.naturalWidth * 0.8)
      const ch = Math.round(img.naturalHeight * 0.8)
      setCrop({
        x: Math.round((img.naturalWidth - cw) / 2),
        y: Math.round((img.naturalHeight - ch) / 2),
        width: cw,
        height: ch,
      })
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Constrain crop to aspect ratio when ratio changes
  useEffect(() => {
    if (!image || aspectRatio === null) return
    setCrop((prev) => constrainToAspectRatio(prev, aspectRatio, image.naturalWidth, image.naturalHeight))
  }, [aspectRatio, image])

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = Math.min(1, MAX_CANVAS_WIDTH / image.naturalWidth)
    scaleRef.current = scale

    const cw = Math.round(image.naturalWidth * scale)
    const ch = Math.round(image.naturalHeight * scale)
    canvas.width = cw
    canvas.height = ch

    // Draw full image
    ctx.drawImage(image, 0, 0, cw, ch)

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, cw, ch)

    // Reveal crop region by drawing image section on top
    const sx = crop.x
    const sy = crop.y
    const sw = crop.width
    const sh = crop.height
    const dx = crop.x * scale
    const dy = crop.y * scale
    const dw = crop.width * scale
    const dh = crop.height * scale
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)

    // Crop border
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.strokeRect(dx, dy, dw, dh)

    // Draw handles
    ctx.fillStyle = 'white'
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    const handles = getHandlePositions(crop, scale)
    for (const h of handles) {
      ctx.fillRect(
        h.x - HANDLE_SIZE / 2,
        h.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE
      )
      ctx.strokeRect(
        h.x - HANDLE_SIZE / 2,
        h.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE
      )
    }
  }, [image, crop])

  useEffect(() => {
    draw()
  }, [draw])

  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const hitTestHandle = (mx: number, my: number): DragMode => {
    const scale = scaleRef.current
    const handles = getHandlePositions(crop, scale)
    const modes: DragMode[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
    const hitRadius = HANDLE_SIZE + 2
    for (let i = 0; i < handles.length; i++) {
      if (
        Math.abs(mx - handles[i].x) <= hitRadius &&
        Math.abs(my - handles[i].y) <= hitRadius
      ) {
        return modes[i]
      }
    }
    // Check if inside crop
    const dx = crop.x * scale
    const dy = crop.y * scale
    const dw = crop.width * scale
    const dh = crop.height * scale
    if (mx >= dx && mx <= dx + dw && my >= dy && my <= dy + dh) {
      return 'move'
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e)
    const mode = hitTestHandle(pos.x, pos.y)
    if (!mode) return
    dragModeRef.current = mode
    dragStartRef.current = { mx: pos.x, my: pos.y, crop: { ...crop } }
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const mode = dragModeRef.current
    if (!mode || !image) return

    const pos = getMousePos(e)
    const scale = scaleRef.current
    const start = dragStartRef.current
    const deltaX = (pos.x - start.mx) / scale
    const deltaY = (pos.y - start.my) / scale
    const imgW = image.naturalWidth
    const imgH = image.naturalHeight

    if (mode === 'move') {
      let nx = start.crop.x + deltaX
      let ny = start.crop.y + deltaY
      nx = Math.max(0, Math.min(nx, imgW - start.crop.width))
      ny = Math.max(0, Math.min(ny, imgH - start.crop.height))
      setCrop({ ...start.crop, x: Math.round(nx), y: Math.round(ny) })
      return
    }

    // Resize
    let { x, y, width, height } = start.crop

    if (mode.includes('w')) {
      const newX = x + deltaX
      width = x + width - newX
      x = newX
    }
    if (mode.includes('e')) {
      width = width + deltaX
    }
    if (mode.includes('n')) {
      const newY = y + deltaY
      height = y + height - newY
      y = newY
    }
    if (mode.includes('s')) {
      height = height + deltaY
    }

    // Enforce minimum size
    if (width < 20) {
      if (mode.includes('w')) x = start.crop.x + start.crop.width - 20
      width = 20
    }
    if (height < 20) {
      if (mode.includes('n')) y = start.crop.y + start.crop.height - 20
      height = 20
    }

    // Constrain to aspect ratio if locked
    if (aspectRatio !== null) {
      if (mode === 'n' || mode === 's') {
        width = height * aspectRatio
        // Anchor horizontally from center for pure vertical drags
        x = start.crop.x + (start.crop.width - width) / 2
      } else if (mode === 'w' || mode === 'e') {
        height = width / aspectRatio
        // Anchor vertically from center for pure horizontal drags
        y = start.crop.y + (start.crop.height - height) / 2
      } else {
        // Corner drag: use the larger dimension change to determine size
        const candidateW = height * aspectRatio
        const candidateH = width / aspectRatio
        if (candidateW <= width) {
          width = candidateH * aspectRatio
          height = candidateH
        } else {
          width = candidateW
          height = candidateW / aspectRatio
        }
      }
    }

    // Clamp to image bounds
    x = Math.max(0, Math.min(x, imgW - 20))
    y = Math.max(0, Math.min(y, imgH - 20))
    width = Math.min(width, imgW - x)
    height = Math.min(height, imgH - y)

    setCrop({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.max(20, width)),
      height: Math.round(Math.max(20, height)),
    })
  }

  const handleMouseUp = () => {
    dragModeRef.current = null
  }

  const handleDownload = async () => {
    if (!image) return
    setDownloading(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = crop.width
      canvas.height = crop.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      )

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const baseName = file.name.replace(/\.[^.]+$/, '')
      a.download = `${baseName}-cropped-${crop.width}x${crop.height}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      trackToolUsage('crop')
    } finally {
      setDownloading(false)
    }
  }

  const getCursorForMode = (mode: DragMode): string => {
    if (!mode) return 'default'
    if (mode === 'move') return 'move'
    const map: Record<string, string> = {
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize',
    }
    return map[mode] || 'default'
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Update cursor based on hover
    if (!dragModeRef.current && canvasRef.current) {
      const pos = getMousePos(e)
      const mode = hitTestHandle(pos.x, pos.y)
      canvasRef.current.style.cursor = getCursorForMode(mode)
    }
    handleMouseMove(e)
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
      {/* Canvas */}
      <div className="flex justify-center bg-gray-100 rounded-lg p-4">
        <canvas
          ref={canvasRef}
          className="max-w-full rounded shadow"
          onMouseDown={handleMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Crop dimensions */}
      <p className="text-sm text-gray-500 text-center">
        Crop region: {crop.width}&times;{crop.height}px (from {crop.x},{crop.y})
      </p>

      {/* Aspect ratio presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Aspect ratio
        </label>
        <div className="flex gap-2 flex-wrap">
          {aspectRatios.map((ar) => (
            <button
              key={ar.label}
              onClick={() => setAspectRatio(ar.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                aspectRatio === ar.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {ar.label}
            </button>
          ))}
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
          disabled={downloading || crop.width < 1 || crop.height < 1}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          {downloading
            ? 'Processing...'
            : `Download Crop (${crop.width}\u00d7${crop.height})`}
        </button>
      </div>
    </div>
  )
}

function getHandlePositions(crop: CropRect, scale: number) {
  const x = crop.x * scale
  const y = crop.y * scale
  const w = crop.width * scale
  const h = crop.height * scale
  return [
    { x, y }, // nw
    { x: x + w / 2, y }, // n
    { x: x + w, y }, // ne
    { x, y: y + h / 2 }, // w
    { x: x + w, y: y + h / 2 }, // e
    { x, y: y + h }, // sw
    { x: x + w / 2, y: y + h }, // s
    { x: x + w, y: y + h }, // se
  ]
}

function constrainToAspectRatio(
  crop: CropRect,
  ratio: number,
  imgW: number,
  imgH: number
): CropRect {
  let { x, y, width, height } = crop
  // Constrain by reducing the larger dimension
  const currentRatio = width / height
  if (currentRatio > ratio) {
    width = Math.round(height * ratio)
  } else {
    height = Math.round(width / ratio)
  }
  // Ensure within bounds
  if (x + width > imgW) x = imgW - width
  if (y + height > imgH) y = imgH - height
  x = Math.max(0, Math.round(x))
  y = Math.max(0, Math.round(y))
  width = Math.min(width, imgW - x)
  height = Math.min(height, imgH - y)
  return { x, y, width: Math.max(20, width), height: Math.max(20, height) }
}
