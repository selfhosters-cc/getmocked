'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Upload, Trash2, Settings, Play } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Template {
  id: string
  name: string
  originalImagePath: string
  overlayConfig: unknown
  sortOrder: number
}

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: Template[]
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{set.name}</h1>
          {set.description && <p className="text-gray-500">{set.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/sets/${id}/apply`}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700">
            <Play size={18} /> Apply Design
          </Link>
          <button onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
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
            <div key={t.id} className="group relative rounded-xl border bg-white overflow-hidden">
              <img src={`${API_URL}/uploads/${t.originalImagePath}`}
                alt={t.name} className="w-full aspect-square object-cover" />
              <div className="p-3">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-gray-400">{t.overlayConfig ? 'Configured' : 'Not configured'}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Link href={`/sets/${id}/templates/${t.id}/edit`}
                  className="rounded-full bg-white p-2 shadow hover:bg-gray-100">
                  <Settings size={14} />
                </Link>
                <button onClick={() => handleDeleteTemplate(t.id)}
                  className="rounded-full bg-white p-2 shadow hover:bg-red-50">
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
