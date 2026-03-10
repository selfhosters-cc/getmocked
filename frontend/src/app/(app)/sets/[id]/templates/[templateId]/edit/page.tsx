'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MockupCanvas } from '@/components/editor/mockup-canvas'
import { Toolbar } from '@/components/editor/toolbar'
import { OverlayConfig, getDefaultCorners } from '@/lib/canvas-utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function TemplateEditorPage() {
  const { id: setId, templateId } = useParams<{ id: string; templateId: string }>()
  const router = useRouter()
  const [template, setTemplate] = useState<{
    id: string; name: string; originalImagePath: string; overlayConfig: OverlayConfig | null
  } | null>(null)
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [mode, setMode] = useState<'advanced' | 'basic'>('advanced')
  const [displacement, setDisplacement] = useState(0.5)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getSet(setId).then((set) => {
      const t = set.templates.find((t: { id: string }) => t.id === templateId)
      if (t) {
        setTemplate(t)
        if (t.overlayConfig) {
          setConfig(t.overlayConfig)
          setMode(t.overlayConfig.mode || 'advanced')
          setDisplacement(t.overlayConfig.displacementIntensity ?? 0.5)
        }
      }
    })
  }, [setId, templateId])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await api.updateTemplate(setId, templateId, {
        overlayConfig: { ...config, displacementIntensity: displacement, mode },
      })
      router.push(`/sets/${setId}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setConfig(null)
  }

  if (!template) return <div>Loading...</div>

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Edit Template: {template.name}</h1>

      <Toolbar
        mode={mode}
        displacementIntensity={displacement}
        onModeChange={setMode}
        onDisplacementChange={setDisplacement}
        onReset={handleReset}
        onSave={handleSave}
        saving={saving}
      />

      <MockupCanvas
        imageUrl={`${API_URL}/api/mockup-sets/uploads/${template.originalImagePath}`}
        overlayConfig={config}
        onConfigChange={setConfig}
        mode={mode}
      />
    </div>
  )
}
