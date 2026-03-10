'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Loader2, Download, X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

interface OverlaySettings {
  displacementIntensity?: number
  transparency?: number
}

interface Render {
  id: string
  status: string
  mockupTemplate: { name: string; overlayConfig?: OverlaySettings | null }
}

interface BatchDetail {
  id: string
  createdAt: string
  mockupSet: { id: string; name: string }
  design: { id: string; name: string; imagePath: string }
  renders: Render[]
}

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const router = useRouter()
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    api.getBatch(batchId).then(setBatch).catch(() => router.push('/renders')).finally(() => setLoading(false))
  }, [batchId, router])

  const completedRenders = batch?.renders.filter((r) => r.status === 'complete') ?? []

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

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!batch) return null

  return (
    <div>
      <Link href="/renders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to batches
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <img src={`/uploads/${batch.design.imagePath}`} alt={batch.design.name}
          className="w-16 h-16 rounded-lg object-cover shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">{batch.mockupSet.name}</h1>
          <p className="text-gray-500 text-sm">
            Design: {batch.design.name} &middot; {formatDate(batch.createdAt)}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {completedRenders.length} of {batch.renders.length} complete
            {batch.renders.filter((r) => r.status === 'failed').length > 0 && (
              <span className="text-red-400 ml-1">
                ({batch.renders.filter((r) => r.status === 'failed').length} failed)
              </span>
            )}
          </p>
        </div>
      </div>

      {completedRenders.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <a href={api.getZipUrl(batch.mockupSet.id, batch.design.id)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 flex items-center gap-2 text-sm">
            <Download size={16} /> Download All ({completedRenders.length})
          </a>
          <span className="text-sm text-gray-400">Click any image to view full size. Use arrow keys to navigate.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {batch.renders.map((r) => {
          const completedIdx = completedRenders.findIndex((cr) => cr.id === r.id)
          return (
            <div key={r.id} className="rounded-xl border bg-white overflow-hidden">
              {r.status === 'complete' ? (
                <button onClick={() => setLightboxIndex(completedIdx)} className="w-full cursor-zoom-in">
                  <img src={api.getDownloadUrl(r.id)} alt={r.mockupTemplate?.name ?? ''}
                    className="w-full aspect-square object-cover" />
                </button>
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
                  {r.status === 'failed' ? (
                    <span className="text-red-500 text-sm">Failed</span>
                  ) : (
                    <Loader2 className="animate-spin text-gray-400" />
                  )}
                </div>
              )}
              <div className="p-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm truncate">{r.mockupTemplate?.name ?? 'Rendering...'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="capitalize">{r.status}</span>
                    {r.mockupTemplate?.overlayConfig && (
                      <>
                        <span>D:{Math.round((r.mockupTemplate.overlayConfig.displacementIntensity ?? 0) * 100)}%</span>
                        {(r.mockupTemplate.overlayConfig.transparency ?? 0) > 0 && (
                          <span>T:{Math.round((r.mockupTemplate.overlayConfig.transparency ?? 0) * 100)}%</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {r.status === 'complete' && (
                  <a href={api.getDownloadUrl(r.id)} download
                    className="shrink-0 ml-2 p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    title="Download">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

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
            <span>{completedRenders[lightboxIndex].mockupTemplate?.name}</span>
            {completedRenders[lightboxIndex].mockupTemplate?.overlayConfig && (
              <span className="text-white/50">
                D:{Math.round((completedRenders[lightboxIndex].mockupTemplate.overlayConfig?.displacementIntensity ?? 0) * 100)}%
                {(completedRenders[lightboxIndex].mockupTemplate.overlayConfig?.transparency ?? 0) > 0 && (
                  <> T:{Math.round((completedRenders[lightboxIndex].mockupTemplate.overlayConfig?.transparency ?? 0) * 100)}%</>
                )}
              </span>
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
            alt={completedRenders[lightboxIndex].mockupTemplate?.name ?? ''}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
