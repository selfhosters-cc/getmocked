'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Upload, Trash2, Settings, Play, Plus, X, Pencil, Check, Heart, ImageDown } from 'lucide-react'

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
  isFavorite?: boolean
}

interface ColorVariant {
  name: string
  hex: string
}

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: Template[]
  colorVariants?: ColorVariant[]
}

function TemplateCard({ template: t, setId, onDelete, onToggleFavorite }: { template: Template; setId: string; onDelete: () => void; onToggleFavorite: () => void }) {
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
        <button onClick={onToggleFavorite}
          className="rounded-full bg-white p-2 shadow hover:bg-pink-50">
          <Heart size={14} className={t.isFavorite ? 'fill-pink-500 text-pink-500' : 'text-gray-400'} />
        </button>
        <Link href={`/sets/${setId}/templates/${t.id}/renders`}
          className="rounded-full bg-white p-2 shadow hover:bg-gray-100" title="View renders">
          <ImageDown size={14} />
        </Link>
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

function ColorVariantManager({ setId, variants, onUpdate }: { setId: string; variants: ColorVariant[]; onUpdate: () => void }) {
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#000000')

  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const updated = [...variants, { name: trimmed, hex: newHex }]
    await api.updateSetColors(setId, updated)
    setNewName('')
    setNewHex('#000000')
    onUpdate()
  }

  const handleRemove = async (index: number) => {
    const updated = variants.filter((_, i) => i !== index)
    await api.updateSetColors(setId, updated)
    onUpdate()
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Color Variants</h2>
      <div className="flex flex-wrap items-start gap-4 mb-4">
        {variants.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border border-gray-200" style={{ backgroundColor: v.hex }} />
              <button onClick={() => handleRemove(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                <X size={10} />
              </button>
            </div>
            <span className="text-xs text-gray-600 max-w-[60px] truncate text-center">{v.name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Color name" className="rounded-lg border px-3 py-1.5 text-sm w-36" />
        <input type="color" value={newHex} onChange={(e) => setNewHex(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
        <button onClick={handleAdd} disabled={!newName.trim()}
          className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}

export default function SetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [set, setSet] = useState<MockupSet | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [descValue, setDescValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLInputElement>(null)

  const startEditingName = () => {
    if (!set) return
    setNameValue(set.name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const saveName = async () => {
    if (!set) return
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === set.name) {
      setEditingName(false)
      return
    }
    await api.updateSet(id, { name: trimmed })
    setSet({ ...set, name: trimmed })
    setEditingName(false)
  }

  const startEditingDesc = () => {
    if (!set) return
    setDescValue(set.description ?? '')
    setEditingDesc(true)
    setTimeout(() => descInputRef.current?.focus(), 0)
  }

  const saveDesc = async () => {
    if (!set) return
    const trimmed = descValue.trim()
    if (trimmed === (set.description ?? '')) {
      setEditingDesc(false)
      return
    }
    await api.updateSet(id, { description: trimmed })
    setSet({ ...set, description: trimmed || undefined })
    setEditingDesc(false)
  }

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

  const handleToggleFavorite = async (templateId: string, current: boolean) => {
    await api.toggleTemplateFavorite(id, templateId, !current)
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
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 outline-none py-0 px-1 -ml-1"
              />
              <button onClick={saveName} className="text-green-600 hover:text-green-700">
                <Check size={18} />
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold group/name cursor-pointer inline-flex items-center gap-2"
              onClick={startEditingName}
            >
              {set.name}
              <Pencil size={14} className="text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </h1>
          )}
          {editingDesc ? (
            <input
              ref={descInputRef}
              type="text"
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDesc()
                if (e.key === 'Escape') setEditingDesc(false)
              }}
              className="text-gray-500 bg-transparent border-b-2 border-blue-500 outline-none py-0 px-1 -ml-1 w-full mt-1"
              placeholder="Add a description..."
            />
          ) : (
            <p
              className="text-gray-500 cursor-pointer mt-1 hover:text-gray-700 transition-colors"
              onClick={startEditingDesc}
            >
              {set.description || <span className="italic text-gray-400">Add a description...</span>}
            </p>
          )}
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
              onDelete={() => handleDeleteTemplate(t.id)}
              onToggleFavorite={() => handleToggleFavorite(t.id, !!t.isFavorite)} />
          ))}
        </div>
      )}

      <ColorVariantManager setId={id} variants={set.colorVariants ?? []}
        onUpdate={() => api.getSet(id).then(setSet)} />
    </div>
  )
}
