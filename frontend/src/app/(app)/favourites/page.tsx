'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Heart, Download } from 'lucide-react'

interface FavTemplate {
  id: string
  name: string
  originalImagePath: string
  isFavorite: boolean
  mockupSet: { id: string; name: string }
}

interface FavRender {
  id: string
  isFavorite: boolean
  renderedImagePath: string
  status: string
  mockupTemplate: { name: string }
  design: { name: string }
}

export default function FavouritesPage() {
  const [templates, setTemplates] = useState<FavTemplate[]>([])
  const [renders, setRenders] = useState<FavRender[]>([])

  const load = () => api.getFavorites().then((data: { templates: FavTemplate[]; renders: FavRender[] }) => {
    setTemplates(data.templates)
    setRenders(data.renders)
  })

  useEffect(() => { load() }, [])

  const unfavTemplate = async (setId: string, templateId: string) => {
    await api.toggleTemplateFavorite(setId, templateId, false)
    load()
  }

  const unfavRender = async (renderId: string) => {
    await api.toggleRenderFavorite(renderId)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Favourites</h1>

      <h2 className="text-lg font-semibold mb-3">Templates</h2>
      {templates.length === 0 ? (
        <p className="text-sm text-gray-400 mb-6">No favourite templates yet. Click the heart icon on any template to add it.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {templates.map((t) => (
            <div key={t.id} className="group relative rounded-xl border bg-white overflow-hidden">
              <Link href={`/sets/${t.mockupSet.id}/templates/${t.id}/edit`}>
                <img src={`/uploads/${t.originalImagePath}`} alt={t.name}
                  className="w-full aspect-square object-cover" />
              </Link>
              <div className="p-3">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-gray-400 truncate">{t.mockupSet.name}</p>
              </div>
              <button onClick={() => unfavTemplate(t.mockupSet.id, t.id)}
                className="absolute top-2 right-2 rounded-full bg-white p-2 shadow hover:bg-pink-50">
                <Heart size={14} className="fill-pink-500 text-pink-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Renders</h2>
      {renders.length === 0 ? (
        <p className="text-sm text-gray-400">No favourite renders yet. Click the heart icon on any completed render to add it.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {renders.map((r) => (
            <div key={r.id} className="group relative rounded-xl border bg-white overflow-hidden">
              {r.status === 'complete' && (
                <img src={api.getDownloadUrl(r.id)} alt={r.mockupTemplate.name}
                  className="w-full aspect-square object-cover" />
              )}
              <div className="p-2">
                <p className="text-sm truncate">{r.mockupTemplate.name}</p>
                <p className="text-xs text-gray-400 truncate">Design: {r.design.name}</p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => unfavRender(r.id)}
                  className="rounded-full bg-white p-2 shadow hover:bg-pink-50">
                  <Heart size={14} className="fill-pink-500 text-pink-500" />
                </button>
                {r.status === 'complete' && (
                  <a href={api.getDownloadUrl(r.id)} download
                    className="rounded-full bg-white p-2 shadow hover:bg-gray-100">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
