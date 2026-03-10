'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Upload, Trash2, Settings, Play } from 'lucide-react'

interface OverlayCorner {
  x: number
  y: number
}

interface TemplateOverlayConfig {
  corners: OverlayCorner[]
  displacementIntensity?: number
  transparency?: number
  curvature?: number
  curveAxis?: string
  mode?: string
}

interface Template {
  id: string
  name: string
  originalImagePath: string
  overlayConfig: TemplateOverlayConfig | null
  sortOrder: number
}

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: Template[]
}

function TemplateCard({ template: t, setId, onDelete }: { template: Template; setId: string; onDelete: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  const onLoad = useCallback(() => {
    const img = imgRef.current
    if (img) setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
  }, [])

  const corners = t.overlayConfig?.corners
  const displacement = t.overlayConfig?.displacementIntensity
  const tTransparency = t.overlayConfig?.transparency
  const tCurvature = t.overlayConfig?.curvature

  return (
    <div className="group relative rounded-xl border bg-white overflow-hidden">
      <div className="relative aspect-square">
        <img ref={imgRef} src={`/uploads/${t.originalImagePath}`}
          alt={t.name} className="w-full h-full object-cover" onLoad={onLoad} />
        {corners && corners.length === 4 && imgSize && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`} preserveAspectRatio="xMidYMid slice">
            <polygon
              points={corners.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)"
              strokeWidth={Math.max(imgSize.w, imgSize.h) * 0.005}
              strokeDasharray={`${Math.max(imgSize.w, imgSize.h) * 0.015} ${Math.max(imgSize.w, imgSize.h) * 0.01}`}
            />
          </svg>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{t.name}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {t.overlayConfig ? (
            <>
              <span className="text-green-600">Configured</span>
              {displacement !== undefined && (
                <span>Disp: {Math.round(displacement * 100)}%</span>
              )}
              {tTransparency !== undefined && tTransparency > 0 && (
                <span>Trans: {Math.round(tTransparency * 100)}%</span>
              )}
              {tCurvature !== undefined && Math.abs(tCurvature) > 0.01 && (
                <span>Curve: {Math.round(tCurvature * 100)}%</span>
              )}
            </>
          ) : (
            <span>Not configured</span>
          )}
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
        <Link href={`/sets/${setId}/templates/${t.id}/edit`}
          className="rounded-full bg-white p-2 shadow hover:bg-gray-100">
          <Settings size={14} />
        </Link>
        <button onClick={onDelete}
          className="rounded-full bg-white p-2 shadow hover:bg-red-50">
          <Trash2 size={14} className="text-red-500" />
        </button>
      </div>
    </div>
  )
}

export default function SetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [set, setSet] = useState<MockupSet | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getSet(id).then(setSet)
  }, [id])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      await api.uploadTemplate(id, file)
    }
    api.getSet(id).then(setSet)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return
    await api.deleteTemplate(id, templateId)
    api.getSet(id).then(setSet)
  }

  if (!set) return <div>Loading...</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{set.name}</h1>
          {set.description && <p className="text-gray-500">{set.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/sets/${id}/apply`}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 text-sm sm:text-base">
            <Play size={18} /> Apply Design
          </Link>
          <button onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 text-sm sm:text-base">
            <Upload size={18} /> Add Photos
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {set.templates.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <p className="text-lg">No templates yet</p>
          <p className="text-sm">Upload product photos to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {set.templates.map((t) => (
            <TemplateCard key={t.id} template={t} setId={id}
              onDelete={() => handleDeleteTemplate(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
