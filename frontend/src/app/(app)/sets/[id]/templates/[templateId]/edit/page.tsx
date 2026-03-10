'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MockupCanvas } from '@/components/editor/mockup-canvas'
import { MaskEditor } from '@/components/editor/mask-editor'
import { Toolbar } from '@/components/editor/toolbar'
import { OverlayConfig, CurveAxis } from '@/lib/canvas-utils'

interface Design {
  id: string
  name: string
  imagePath: string
}

export default function TemplateEditorPage() {
  const { id: setId, templateId } = useParams<{ id: string; templateId: string }>()
  const router = useRouter()
  const [template, setTemplate] = useState<{
    id: string; name: string; originalImagePath: string; overlayConfig: OverlayConfig | null
  } | null>(null)
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [mode, setMode] = useState<'advanced' | 'basic'>('advanced')
  const [displacement, setDisplacement] = useState(0.5)
  const [transparency, setTransparency] = useState(0.0)
  const [curvature, setCurvature] = useState(0.0)
  const [curveAxis, setCurveAxis] = useState<CurveAxis>('auto')
  const [saving, setSaving] = useState(false)
  const [designs, setDesigns] = useState<Design[]>([])
  const [selectedDesignUrl, setSelectedDesignUrl] = useState<string | null>(null)

  useEffect(() => {
    api.getSet(setId).then((set) => {
      const t = set.templates.find((t: { id: string }) => t.id === templateId)
      if (t) {
        setTemplate(t)
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
    api.getDesigns().then(setDesigns)
  }, [setId, templateId])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await api.updateTemplate(setId, templateId, {
        overlayConfig: {
          ...config,
          displacementIntensity: displacement,
          transparency,
          curvature,
          curveAxis,
          mode,
        },
      })
      router.push(`/sets/${setId}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setConfig(null)
    setCurvature(0.0)
    setCurveAxis('auto')
  }

  const handleDesignSelect = (designId: string) => {
    if (!designId) {
      setSelectedDesignUrl(null)
      return
    }
    const d = designs.find((d) => d.id === designId)
    if (d) setSelectedDesignUrl(`/uploads/${d.imagePath}`)
  }

  if (!template) return <div>Loading...</div>

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Edit Template: {template.name}</h1>

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
        onSave={handleSave}
        saving={saving}
      />

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium">Preview design:</label>
        <select onChange={(e) => handleDesignSelect(e.target.value)}
          className="rounded border px-2 py-1 text-sm" defaultValue="">
          <option value="">None</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {selectedDesignUrl && (
          <img src={selectedDesignUrl} alt="Preview design" className="w-8 h-8 rounded object-cover" />
        )}
      </div>

      <MockupCanvas
        imageUrl={`/uploads/${template.originalImagePath}`}
        overlayConfig={config}
        previewDesignUrl={selectedDesignUrl ?? undefined}
        transparency={transparency}
        displacement={displacement}
        curvature={curvature}
        curveAxis={curveAxis}
        onConfigChange={setConfig}
        mode={mode}
      />

      <details className="mt-6 border rounded-lg">
        <summary className="px-4 py-3 cursor-pointer font-medium text-sm text-gray-700 hover:bg-gray-50">
          Product Mask (for color variants)
        </summary>
        <div className="p-4 border-t">
          <MaskEditor
            setId={setId}
            templateId={templateId}
            imageUrl={`/uploads/${template.originalImagePath}`}
          />
        </div>
      </details>
    </div>
  )
}
