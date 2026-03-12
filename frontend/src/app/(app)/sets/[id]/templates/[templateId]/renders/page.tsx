'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Download, ArrowLeft, ChevronLeft, ChevronRight, Heart, X } from 'lucide-react'

interface TemplateRender {
  id: string
  status: string
  renderedImagePath: string
  renderOptions?: { tintColor?: string }
  isFavorite?: boolean
  createdAt: string
  design: { id: string; name: string; imagePath: string }
  batch: { id: string; createdAt: string; description?: string } | null
}

export default function TemplateRendersPage() {
  const { id: setId, templateId } = useParams<{ id: string; templateId: string }>()
  const [renders, setRenders] = useState<TemplateRender[]>([])
  const [templateName, setTemplateName] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const fetchPage = (p: number) => {
    api.getTemplateRenders(setId, templateId, p).then((data: { renders: TemplateRender[]; total: number; page: number; totalPages: number }) => {
      setRenders(data.renders)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
    })
  }

  useEffect(() => {
    fetchPage(1)
    api.getSet(setId).then((set: { templates: { id: string; name: string }[] }) => {
      const t = set.templates.find((t: { id: string }) => t.id === templateId)
      if (t) setTemplateName(t.name)
    })
  }, [setId, templateId])

  const toggleFav = async (renderId: string) => {
    await api.toggleRenderFavorite(renderId)
    fetchPage(page)
  }

  const completedRenders = renders.filter((r) => r.status === 'complete')

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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div>
      <Link href={`/sets/${setId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to set
      </Link>

      <h1 className="text-2xl font-bold mb-1">Renders: {templateName || '...'}</h1>
      <p className="text-sm text-gray-500 mb-6">{total} render{total !== 1 ? 's' : ''} across all batches</p>

      {renders.length === 0 ? (
        <p className="text-sm text-gray-400">No renders yet for this template.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {renders.map((r) => {
              const completedIdx = completedRenders.findIndex((cr) => cr.id === r.id)
              return (
                <div key={r.id} className="rounded-xl border bg-white overflow-hidden group relative">
                  {r.status === 'complete' ? (
                    <button onClick={() => setLightboxIndex(completedIdx)} className="w-full cursor-zoom-in">
                      <img src={api.getDownloadUrl(r.id)} alt={templateName}
                        className="w-full aspect-square object-cover" />
                    </button>
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center bg-gray-100 text-sm text-gray-400 capitalize">
                      {r.status}
                    </div>
                  )}
                  <div className="p-2">
                    <div className="flex items-center gap-1.5">
                      {r.renderOptions?.tintColor && (
                        <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                          style={{ backgroundColor: r.renderOptions.tintColor }} />
                      )}
                      <p className="text-sm truncate">{r.design.name}</p>
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                    {r.batch?.description && (
                      <p className="text-xs text-gray-400 truncate">{r.batch.description}</p>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleFav(r.id)}
                      className="rounded-full bg-white p-1.5 shadow hover:bg-pink-50">
                      <Heart size={12} className={r.isFavorite ? 'fill-pink-500 text-pink-500' : 'text-gray-400'} />
                    </button>
                    {r.status === 'complete' && (
                      <a href={api.getDownloadUrl(r.id)} download
                        className="rounded-full bg-white p-1.5 shadow hover:bg-gray-100">
                        <Download size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => fetchPage(page - 1)} disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30">
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => fetchPage(page + 1)} disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30">
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
            <span>{completedRenders[lightboxIndex].design.name}</span>
            {completedRenders[lightboxIndex].renderOptions?.tintColor && (
              <span className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: completedRenders[lightboxIndex].renderOptions?.tintColor }} />
            )}
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
            alt={completedRenders[lightboxIndex].design.name}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
