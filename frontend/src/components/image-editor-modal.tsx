'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, RotateCcw, RotateCw } from 'lucide-react'

interface ImageEditorModalProps {
  imageId: string
  imagePath: string
  onClose: () => void
  onSaved: () => void
}

interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

type AspectRatio = 'free' | '1:1' | '4:3' | '3:2' | '16:9'

const RATIOS: { label: AspectRatio; value: number | null }[] = [
  { label: 'free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
]

export function ImageEditorModal({ imageId, imagePath, onClose, onSaved }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [imageLoaded, setImageLoaded] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, width: 0, height: 0 })
  const [ratio, setRatio] = useState<AspectRatio>('free')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cropStart, setCropStart] = useState<CropBox>({ x: 0, y: 0, width: 0, height: 0 })

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
  const scaleRef = useRef(1)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      const w = rotation % 180 === 0 ? img.naturalWidth : img.naturalHeight
      const h = rotation % 180 === 0 ? img.naturalHeight : img.naturalWidth
      setImgSize({ width: w, height: h })

      const containerWidth = containerRef.current?.clientWidth ?? 800
      const maxHeight = window.innerHeight * 0.6
      const scale = Math.min(1, containerWidth / w, maxHeight / h)
      scaleRef.current = scale
      setCanvasSize({ width: Math.round(w * scale), height: Math.round(h * scale) })

      setCrop({ x: 0, y: 0, width: w, height: h })
      setImageLoaded(true)
    }
    img.src = `/uploads/${imagePath}`
  }, [imagePath, rotation])

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !canvasSize.width) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = scaleRef.current

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    // Draw rotated image
    ctx.save()
    ctx.translate(canvasSize.width / 2, canvasSize.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    const drawW = img.naturalWidth * scale
    const drawH = img.naturalHeight * scale
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()

    // Draw dark overlay outside crop
    const cx = crop.x * scale
    const cy = crop.y * scale
    const cw = crop.width * scale
    const ch = crop.height * scale

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvasSize.width, cy)
    ctx.fillRect(0, cy + ch, canvasSize.width, canvasSize.height - cy - ch)
    ctx.fillRect(0, cy, cx, ch)
    ctx.fillRect(cx + cw, cy, canvasSize.width - cx - cw, ch)

    // Crop border
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, cw, ch)

    // Rule of thirds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + (cw * i) / 3, cy)
      ctx.lineTo(cx + (cw * i) / 3, cy + ch)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy + (ch * i) / 3)
      ctx.lineTo(cx + cw, cy + (ch * i) / 3)
      ctx.stroke()
    }

    // Corner handles
    const handleSize = 10
    ctx.fillStyle = 'white'
    const corners = [
      [cx, cy], [cx + cw, cy],
      [cx, cy + ch], [cx + cw, cy + ch],
    ]
    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize)
    }
  }, [canvasSize, crop, rotation])

  useEffect(() => { draw() }, [draw])

  const toImageCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scale = scaleRef.current
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const getHitZone = (mx: number, my: number): string => {
    const handleRadius = 8 / scaleRef.current
    const { x, y, width, height } = crop

    if (Math.abs(mx - x) < handleRadius && Math.abs(my - y) < handleRadius) return 'tl'
    if (Math.abs(mx - (x + width)) < handleRadius && Math.abs(my - y) < handleRadius) return 'tr'
    if (Math.abs(mx - x) < handleRadius && Math.abs(my - (y + height)) < handleRadius) return 'bl'
    if (Math.abs(mx - (x + width)) < handleRadius && Math.abs(my - (y + height)) < handleRadius) return 'br'

    if (mx >= x && mx <= x + width) {
      if (Math.abs(my - y) < handleRadius) return 'top'
      if (Math.abs(my - (y + height)) < handleRadius) return 'bottom'
    }
    if (my >= y && my <= y + height) {
      if (Math.abs(mx - x) < handleRadius) return 'left'
      if (Math.abs(mx - (x + width)) < handleRadius) return 'right'
    }

    if (mx >= x && mx <= x + width && my >= y && my <= y + height) return 'move'
    return ''
  }

  const getCursor = (zone: string): string => {
    const cursors: Record<string, string> = {
      tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize',
      top: 'ns-resize', bottom: 'ns-resize', left: 'ew-resize', right: 'ew-resize',
      move: 'move',
    }
    return cursors[zone] || 'crosshair'
  }

  const constrainCrop = (box: CropBox): CropBox => {
    let { x, y, width, height } = box
    const ratioVal = RATIOS.find((r) => r.label === ratio)?.value

    if (ratioVal && width > 0 && height > 0) {
      height = width / ratioVal
    }

    x = Math.max(0, Math.min(x, imgSize.width - width))
    y = Math.max(0, Math.min(y, imgSize.height - height))
    width = Math.min(width, imgSize.width - x)
    height = Math.min(height, imgSize.height - y)

    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pt = toImageCoords(e)
    const zone = getHitZone(pt.x, pt.y)
    if (!zone) return
    setDragging(zone)
    setDragStart(pt)
    setCropStart({ ...crop })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = toImageCoords(e)

    if (!dragging) {
      const zone = getHitZone(pt.x, pt.y)
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = getCursor(zone)
      return
    }

    const dx = pt.x - dragStart.x
    const dy = pt.y - dragStart.y
    let newCrop = { ...cropStart }

    switch (dragging) {
      case 'move':
        newCrop.x = cropStart.x + dx
        newCrop.y = cropStart.y + dy
        break
      case 'br':
        newCrop.width = Math.max(50, cropStart.width + dx)
        newCrop.height = Math.max(50, cropStart.height + dy)
        break
      case 'bl':
        newCrop.x = cropStart.x + dx
        newCrop.width = Math.max(50, cropStart.width - dx)
        newCrop.height = Math.max(50, cropStart.height + dy)
        break
      case 'tr':
        newCrop.y = cropStart.y + dy
        newCrop.width = Math.max(50, cropStart.width + dx)
        newCrop.height = Math.max(50, cropStart.height - dy)
        break
      case 'tl':
        newCrop.x = cropStart.x + dx
        newCrop.y = cropStart.y + dy
        newCrop.width = Math.max(50, cropStart.width - dx)
        newCrop.height = Math.max(50, cropStart.height - dy)
        break
      case 'top':
        newCrop.y = cropStart.y + dy
        newCrop.height = Math.max(50, cropStart.height - dy)
        break
      case 'bottom':
        newCrop.height = Math.max(50, cropStart.height + dy)
        break
      case 'left':
        newCrop.x = cropStart.x + dx
        newCrop.width = Math.max(50, cropStart.width - dx)
        break
      case 'right':
        newCrop.width = Math.max(50, cropStart.width + dx)
        break
    }

    setCrop(constrainCrop(newCrop))
  }

  const handleMouseUp = () => {
    setDragging(null)
  }

  const handleRotate = (degrees: number) => {
    setRotation((prev) => ((prev + degrees) % 360 + 360) % 360)
    setImageLoaded(false)
  }

  const handleRatioChange = (r: AspectRatio) => {
    setRatio(r)
    const ratioVal = RATIOS.find((rv) => rv.label === r)?.value
    if (ratioVal) {
      let newWidth = crop.width
      let newHeight = newWidth / ratioVal
      if (newHeight > imgSize.height) {
        newHeight = imgSize.height
        newWidth = newHeight * ratioVal
      }
      if (newWidth > imgSize.width) {
        newWidth = imgSize.width
        newHeight = newWidth / ratioVal
      }
      const cx = crop.x + crop.width / 2
      const cy = crop.y + crop.height / 2
      setCrop(constrainCrop({
        x: cx - newWidth / 2,
        y: cy - newHeight / 2,
        width: newWidth,
        height: newHeight,
      }))
    }
  }

  const handleApply = async () => {
    setSaving(true)
    try {
      const isFullImage = crop.x === 0 && crop.y === 0 &&
        crop.width === imgSize.width && crop.height === imgSize.height
      await api.editTemplateImage(imageId, {
        rotation: rotation || undefined,
        crop: isFullImage ? undefined : crop,
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = rotation !== 0 ||
    crop.x !== 0 || crop.y !== 0 ||
    crop.width !== imgSize.width || crop.height !== imgSize.height

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Edit Image</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-1">
            <button onClick={() => handleRotate(-90)}
              className="p-2 rounded hover:bg-gray-200" title="Rotate left">
              <RotateCcw size={18} />
            </button>
            <button onClick={() => handleRotate(90)}
              className="p-2 rounded hover:bg-gray-200" title="Rotate right">
              <RotateCw size={18} />
            </button>
            {rotation > 0 && <span className="text-xs text-gray-500 ml-1">{rotation}</span>}
          </div>

          <div className="w-px h-6 bg-gray-300" />

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Ratio:</span>
            {RATIOS.map((r) => (
              <button key={r.label} onClick={() => handleRatioChange(r.label)}
                className={`px-2 py-1 text-xs rounded ${
                  ratio === r.label ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
                }`}>
                {r.label === 'free' ? 'Free' : r.label}
              </button>
            ))}
          </div>

          {crop.width > 0 && crop.height > 0 && (
            <>
              <div className="w-px h-6 bg-gray-300" />
              <span className="text-xs text-gray-400">
                {Math.round(crop.width)} x {Math.round(crop.height)}px
              </span>
            </>
          )}
        </div>

        <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-100 min-h-0">
          {!imageLoaded ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="border shadow-sm"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={handleApply} disabled={!hasChanges || saving}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
