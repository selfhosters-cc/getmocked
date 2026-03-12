'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Heart, Download, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface FavTemplate {
  id: string
  name: string
  isFavorite: boolean
  mockupSet: { id: string; name: string }
  templateImage: { imagePath: string; thumbnailPath: string | null }
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
  const [renderPage, setRenderPage] = useState(1)
  const [renderTotalPages, setRenderTotalPages] = useState(1)
  const [renderTotal, setRenderTotal] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const load = (page?: number) => {
    const p = page ?? renderPage
    api.getFavorites(p).then((data: { templates: FavTemplate[]; renders: FavRender[]; renderPage: number; renderTotalPages: number; renderTotal: number }) => {
      setTemplates(data.templates)
      setRenders(data.renders)
      setRenderPage(data.renderPage)
      setRenderTotalPages(data.renderTotalPages)
      setRenderTotal(data.renderTotal)
    })
  }

  useEffect(() => { load(1) }, [])

  const completedRenders = renders.filter((r) => r.status === 'complete')

  const unfavTemplate = async (setId: string, templateId: string) => {
    await api.toggleTemplateFavorite(setId, templateId, false)
    load()
  }

  const unfavRender = async (renderId: string) => {
    await api.toggleRenderFavorite(renderId)
    load()
  }

  const fetchRenderPage = (p: number) => {
    setLightboxIndex(null)
    load(p)
  }

  const closeLightbox = () => setLightboxIndex(null)

  const navigateLightbox = useCallback((dir: number) => {
    if (lightboxIndex === null) return
    const newIdx = lightboxIndex + dir
    if (newIdx >= 0 && newIdx < completedRenders.length) {
      setLightboxIndex(newIdx)
    }
  }, [lightboxIndex, completedRenders.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') navigateLightbox(-1)
      if (e.key === 'ArrowRight') navigateLightbox(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, navigateLightbox])

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
                <img src={t.templateImage?.thumbnailPath ? `/uploads/${t.templateImage.thumbnailPath}` : t.templateImage?.imagePath ? `/api/thumbnails/${t.templateImage.imagePath}` : ''} alt={t.name}
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {renders.map((r) => {
              const completedIdx = completedRenders.findIndex((cr) => cr.id === r.id)
              return (
                <div key={r.id} className="group relative rounded-xl border bg-white overflow-hidden">
                  {r.status === 'complete' && (
                    <button onClick={() => setLightboxIndex(completedIdx)} className="w-full cursor-zoom-in">
                      <img src={api.getDownloadUrl(r.id)} alt={r.mockupTemplate.name}
                        className="w-full aspect-square object-cover" />
                    </button>
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
              )
            })}
          </div>

          {/* Pagination */}
          {renderTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchRenderPage(renderPage - 1)}
                disabled={renderPage <= 1}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: renderTotalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === renderTotalPages || Math.abs(p - renderPage) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1]) > 1) acc.push('ellipsis')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, i) =>
                    item === 'ellipsis' ? (
                      <span key={`e-${i}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => fetchRenderPage(item)}
                        className={`min-w-[2.25rem] rounded-lg px-3 py-2 text-sm ${
                          item === renderPage
                            ? 'bg-blue-600 text-white'
                            : 'border hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => fetchRenderPage(renderPage + 1)}
                disabled={renderPage >= renderTotalPages}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && completedRenders[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}>
          <button onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
            <X size={28} />
          </button>

          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {completedRenders.length}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-4 py-2 rounded-lg flex items-center gap-3">
            <span>{completedRenders[lightboxIndex].mockupTemplate.name}</span>
            <span className="text-white/50">{completedRenders[lightboxIndex].design.name}</span>
            <a href={api.getDownloadUrl(completedRenders[lightboxIndex].id)} download
              onClick={(e) => e.stopPropagation()}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Download size={14} /> Download
            </a>
          </div>

          {lightboxIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); navigateLightbox(-1) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2">
              <ChevronLeft size={36} />
            </button>
          )}

          {lightboxIndex < completedRenders.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); navigateLightbox(1) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2">
              <ChevronRight size={36} />
            </button>
          )}

          <img
            src={api.getDownloadUrl(completedRenders[lightboxIndex].id)}
            alt={completedRenders[lightboxIndex].mockupTemplate.name}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
