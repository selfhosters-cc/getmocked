'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Loader2, Download, X, ChevronLeft, ChevronRight, ArrowLeft, Heart, RefreshCw, Store, CheckSquare, Square } from 'lucide-react'
import { RemixModal, RemixRender } from '@/components/remix-modal'
import { SendToShopModal } from '@/components/send-to-shop-modal'

interface OverlaySettings {
  displacementIntensity?: number
  transparency?: number
}

interface Render {
  id: string
  status: string
  isFavorite?: boolean
  renderOptions?: { tintColor?: string; outputMode?: string; outputColor?: string }
  mockupTemplate: { id: string; name: string; overlayConfig?: OverlaySettings | null }
}

interface BatchDetail {
  id: string
  createdAt: string
  description?: string | null
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
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [remixRender, setRemixRender] = useState<Render | null>(null)
  const [selectedRenders, setSelectedRenders] = useState<Set<string>>(new Set())
  const [showSendModal, setShowSendModal] = useState(false)

  useEffect(() => {
    api.getBatch(batchId).then((b) => { setBatch(b); setDescValue(b.description ?? '') }).catch(() => router.push('/renders')).finally(() => setLoading(false))
  }, [batchId, router])

  const toggleRenderFav = async (renderId: string) => {
    await api.toggleRenderFavorite(renderId)
    api.getBatch(batchId).then((b) => { setBatch(b); setDescValue(b.description ?? '') })
  }

  const completedRenders = batch?.renders.filter((r) => r.status === 'complete') ?? []

  const toggleSelectRender = (id: string) => {
    setSelectedRenders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedRenders.size === completedRenders.length) {
      setSelectedRenders(new Set())
    } else {
      setSelectedRenders(new Set(completedRenders.map((r) => r.id)))
    }
  }

  const openSendModal = (renderIds?: string[]) => {
    if (renderIds) {
      setSelectedRenders(new Set(renderIds))
    }
    setShowSendModal(true)
  }

  const saveDesc = async () => {
    setEditingDesc(false)
    const val = descValue.trim()
    await api.updateBatch(batchId, { description: val || undefined })
    setBatch((prev) => prev ? { ...prev, description: val || undefined } : prev)
  }

  const handleRemixRendered = () => {
    api.getBatch(batchId).then((b) => { setBatch(b); setDescValue(b.description ?? '') })
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
          {editingDesc ? (
            <input value={descValue} onChange={(e) => setDescValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditingDesc(false) }}
              onBlur={saveDesc}
              placeholder="Add a note..."
              className="text-sm text-gray-500 border-b border-blue-400 outline-none bg-transparent w-full mt-1"
              autoFocus />
          ) : (
            <p className="text-sm text-gray-400 mt-1 cursor-pointer hover:text-gray-600" onClick={() => setEditingDesc(true)}>
              {batch.description || 'Add a note...'}
            </p>
          )}
        </div>
      </div>

      {completedRenders.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <a href={api.getZipUrl(batch.mockupSet.id, batch.design.id)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 flex items-center gap-2 text-sm">
            <Download size={16} /> Download All ({completedRenders.length})
          </a>
          <button
            onClick={() => openSendModal(selectedRenders.size > 0 ? undefined : completedRenders.map((r) => r.id))}
            className="rounded-lg bg-orange-500 px-4 py-2 text-white font-medium hover:bg-orange-600 flex items-center gap-2 text-sm"
          >
            <Store size={16} /> Send to Shop{selectedRenders.size > 0 ? ` (${selectedRenders.size})` : ''}
          </button>
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            {selectedRenders.size === completedRenders.length ? <CheckSquare size={14} /> : <Square size={14} />}
            {selectedRenders.size === completedRenders.length ? 'Deselect All' : 'Select All'}
          </button>
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
                {r.status === 'complete' && (
                  <button
                    onClick={() => toggleSelectRender(r.id)}
                    className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 mr-1"
                    title={selectedRenders.has(r.id) ? 'Deselect' : 'Select'}
                  >
                    {selectedRenders.has(r.id) ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                  </button>
                )}
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
                <button onClick={() => toggleRenderFav(r.id)}
                  className="shrink-0 p-1.5 rounded-full hover:bg-pink-50">
                  <Heart size={14} className={r.isFavorite ? 'fill-pink-500 text-pink-500' : 'text-gray-400'} />
                </button>
                {r.status === 'complete' && (
                  <>
                    <button onClick={() => openSendModal([r.id])}
                      className="shrink-0 ml-1 p-1.5 rounded-full hover:bg-orange-50 text-gray-500 hover:text-orange-600"
                      title="Send to Shop">
                      <Store size={14} />
                    </button>
                    <a href={api.getDownloadUrl(r.id)} download
                      className="shrink-0 ml-1 p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      title="Download">
                      <Download size={14} />
                    </a>
                    <button onClick={() => setRemixRender(r)}
                      className="shrink-0 ml-1 p-1.5 rounded-full hover:bg-blue-50 text-gray-500 hover:text-blue-600"
                      title="Remix">
                      <RefreshCw size={14} />
                    </button>
                  </>
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
            <button onClick={(e) => { e.stopPropagation(); setRemixRender(completedRenders[lightboxIndex]); closeLightbox() }}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <RefreshCw size={14} /> Remix
            </button>
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
      {remixRender && batch && (
        <RemixModal
          render={remixRender as RemixRender}
          setId={batch.mockupSet.id}
          designId={batch.design.id}
          designImagePath={batch.design.imagePath}
          batchId={batch.id}
          onClose={() => setRemixRender(null)}
          onRendered={handleRemixRendered}
        />
      )}
      {showSendModal && (
        <SendToShopModal
          renders={completedRenders
            .filter((r) => selectedRenders.has(r.id))
            .map((r) => ({ id: r.id, renderedImagePath: undefined, mockupTemplate: r.mockupTemplate ? { name: r.mockupTemplate.name } : undefined }))}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </div>
  )
}
