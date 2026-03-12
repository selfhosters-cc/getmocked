'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { MockupCanvas } from '@/components/editor/mockup-canvas'
import { Toolbar } from '@/components/editor/toolbar'
import type { OverlayConfig, CurveAxis } from '@/lib/canvas-utils'
import { X, Loader2, Image as ImageIcon } from 'lucide-react'

interface RemixRender {
  id: string
  status: string
  renderedImagePath?: string
  renderOptions?: { tintColor?: string; outputMode?: string; outputColor?: string }
  isFavorite?: boolean
  createdAt?: string
  mockupTemplate: { id: string; name: string; overlayConfig?: OverlayConfig | null }
  design?: { id: string; name: string; imagePath: string }
}

interface RemixModalProps {
  render: RemixRender
  setId: string
  designId: string
  designImagePath: string
  batchId?: string
  onClose: () => void
  onRendered: (newRender: RemixRender) => void
}

export type { RemixRender }

export function RemixModal({
  render, setId, designId, designImagePath, batchId, onClose, onRendered,
}: RemixModalProps) {
  const [templateImageUrl, setTemplateImageUrl] = useState<string>('')
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [mode, setMode] = useState<'advanced' | 'basic'>('advanced')
  const [displacement, setDisplacement] = useState(0.5)
  const [transparency, setTransparency] = useState(0.0)
  const [curvature, setCurvature] = useState(0.0)
  const [curveAxis, setCurveAxis] = useState<CurveAxis>('auto')

  const [outputMode, setOutputMode] = useState<'original' | 'transparent' | 'solid'>('original')
  const [outputColor, setOutputColor] = useState('#ffffff')
  const [tintColor, setTintColor] = useState<string>('')

  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const templateId = render.mockupTemplate.id

  // Load template data for the canvas
  useEffect(() => {
    api.getSet(setId).then((set: { templates: { id: string; templateImage?: { imagePath: string } | null; overlayConfig: OverlayConfig | null }[] }) => {
      const t = set.templates.find((t) => t.id === templateId)
      if (t) {
        if (t.templateImage) {
          setTemplateImageUrl(`/uploads/${t.templateImage.imagePath}`)
        }
        if (t.overlayConfig) {
          setConfig(t.overlayConfig)
          setMode(t.overlayConfig.mode || 'advanced')
          setDisplacement(t.overlayConfig.displacementIntensity ?? 0.5)
          setTransparency(t.overlayConfig.transparency ?? 0.0)
          setCurvature(t.overlayConfig.curvature ?? 0.0)
          setCurveAxis(t.overlayConfig.curveAxis ?? 'auto')
        }
      }
    })
  }, [setId, templateId])

  // Initialize render options from current render
  useEffect(() => {
    const opts = render.renderOptions
    if (opts?.outputMode === 'transparent') setOutputMode('transparent')
    else if (opts?.outputMode === 'solid') setOutputMode('solid')
    if (opts?.outputColor) setOutputColor(opts.outputColor)
    if (opts?.tintColor) setTintColor(opts.tintColor)
  }, [render.renderOptions])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const buildOverlayConfig = useCallback((): OverlayConfig | null => {
    if (!config) return null
    return {
      ...config,
      displacementIntensity: displacement,
      transparency,
      curvature,
      curveAxis,
      mode,
    }
  }, [config, displacement, transparency, curvature, curveAxis, mode])

  const handleRerender = async () => {
    setRendering(true)
    setError(null)
    try {
      // 1. Save overlay config to template
      const overlayConfig = buildOverlayConfig()
      if (overlayConfig) {
        await api.updateTemplate(setId, templateId, { overlayConfig })
      }

      // 2. Trigger single render
      const result = await api.singleRender({
        mockupTemplateId: templateId,
        designId,
        tintColor: tintColor || undefined,
        outputMode: outputMode !== 'original' ? outputMode : undefined,
        outputColor: outputMode === 'solid' ? outputColor : undefined,
        batchId,
      })

      // 3. Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const updated = await api.getRender(result.renderId)
          if (updated.status === 'complete' || updated.status === 'failed') {
            clearInterval(pollRef.current)
            setRendering(false)
            if (updated.status === 'complete') {
              onRendered(updated)
              onClose()
            } else {
              setError('Render failed. Please try again.')
            }
          }
        } catch {
          clearInterval(pollRef.current)
          setRendering(false)
          setError('Failed to check render status.')
        }
      }, 1500)
    } catch (err) {
      setRendering(false)
      setError(err instanceof Error ? err.message : 'Render failed')
    }
  }

  const handleReset = () => {
    setConfig(null)
    setCurvature(0.0)
    setCurveAxis('auto')
  }

  const designPreviewUrl = `/uploads/${designImagePath}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">Remix: {render.mockupTemplate.name}</h2>
            <p className="text-xs text-gray-500">Adjust settings and re-render. A new render will be created.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Toolbar */}
        <div className="px-4 pt-3 shrink-0">
          <Toolbar
            mode={mode}
            displacementIntensity={displacement}
            transparency={transparency}
            curvature={curvature}
            curveAxis={curveAxis}
            onModeChange={setMode}
            onDisplacementChange={setDisplacement}
            onTransparencyChange={setTransparency}
            onCurvatureChange={setCurvature}
            onCurveAxisChange={setCurveAxis}
            onReset={handleReset}
            onSave={handleRerender}
            saving={rendering}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto px-4 min-h-0 max-h-[50vh]">
          {templateImageUrl ? (
            <MockupCanvas
              imageUrl={templateImageUrl}
              overlayConfig={config}
              previewDesignUrl={designPreviewUrl}
              transparency={transparency}
              displacement={displacement}
              curvature={curvature}
              curveAxis={curveAxis}
              onConfigChange={setConfig}
              mode={mode}
            />
          ) : (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}
        </div>

        {/* Render Options + Actions */}
        <div className="p-4 border-t shrink-0">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Output:</span>
              {(['original', 'transparent', 'solid'] as const).map((opt) => (
                <button key={opt} onClick={() => setOutputMode(opt)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    outputMode === opt
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt === 'original' ? 'Original' : opt === 'transparent' ? 'Transparent' : 'Solid'}
                </button>
              ))}
              {outputMode === 'solid' && (
                <input type="color" value={outputColor} onChange={(e) => setOutputColor(e.target.value)}
                  className="w-6 h-6 rounded border border-gray-300 cursor-pointer" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tint:</span>
              <input type="color" value={tintColor || '#000000'}
                onChange={(e) => setTintColor(e.target.value)}
                className="w-6 h-6 rounded border border-gray-300 cursor-pointer" />
              {tintColor && (
                <button onClick={() => setTintColor('')}
                  className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={handleRerender} disabled={rendering}
              className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {rendering ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
              {rendering ? 'Rendering...' : 'Re-render'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
