'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react'

interface Template {
  id: string
  name: string
  templateImage: {
    imagePath: string
    thumbnailPath: string | null
  }
}

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: Template[]
}

export default function SetsPage() {
  const [sets, setSets] = useState<MockupSet[]>([])

  useEffect(() => {
    api.getSets().then(setSets)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mockup set?')) return
    await api.deleteSet(id)
    setSets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Mockup Sets</h1>
        <Link href="/sets/new" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Plus size={20} /> New Set
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map((set) => (
          <div key={set.id} className="group rounded-xl border bg-white overflow-hidden">
            <Link href={`/sets/${set.id}`}>
              {set.templates.length > 0 ? (
                <div className="grid grid-cols-3 gap-px bg-gray-100">
                  {set.templates.slice(0, 3).map((t) => {
                    const imagePath = t.templateImage.imagePath
                    const thumbPath = t.templateImage.thumbnailPath
                    const src = thumbPath ? `/uploads/${thumbPath}` : imagePath ? `/api/thumbnails/${imagePath}` : ''
                    return (
                      <img key={t.id} src={src} alt={t.name}
                        className="w-full aspect-square object-cover" />
                    )
                  })}
                  {set.templates.length < 3 && Array.from({ length: 3 - set.templates.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-full aspect-square bg-gray-50" />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 bg-gray-50 text-gray-300">
                  <ImageIcon size={32} />
                </div>
              )}
            </Link>
            <div className="p-4 flex justify-between items-start">
              <Link href={`/sets/${set.id}`} className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{set.name}</h3>
                {set.description && <p className="text-gray-500 text-sm mt-1 truncate">{set.description}</p>}
                <p className="text-gray-400 text-sm mt-1">{set.templates.length} template(s)</p>
              </Link>
              <button onClick={() => handleDelete(set.id)}
                className="text-gray-400 hover:text-red-600 ml-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
