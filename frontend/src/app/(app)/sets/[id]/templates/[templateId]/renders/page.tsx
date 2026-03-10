'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Download, ArrowLeft, ChevronLeft, ChevronRight, Heart } from 'lucide-react'

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
            {renders.map((r) => (
              <div key={r.id} className="rounded-xl border bg-white overflow-hidden group relative">
                {r.status === 'complete' ? (
                  <img src={api.getDownloadUrl(r.id)} alt={templateName}
                    className="w-full aspect-square object-cover" />
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
            ))}
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
    </div>
  )
}
