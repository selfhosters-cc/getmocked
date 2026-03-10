'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Upload, Download, Loader2, Image as ImageIcon, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

interface Design {
  id: string
  name: string
  imagePath: string
}

interface OverlaySettings {
  displacementIntensity?: number
  transparency?: number
}

interface RenderStatus {
  id: string
  status: string
  mockupTemplate: { name: string; overlayConfig?: OverlaySettings | null }
  renderedImagePath: string
  renderOptions?: { tintColor?: string; outputMode?: string; outputColor?: string }
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export default function ApplyDesignPage() {
  const { id: setId } = useParams<{ id: string }>()
  const [designs, setDesigns] = useState<Design[]>([])
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null)
  const [renders, setRenders] = useState<RenderStatus[]>([])
  const [rendering, setRendering] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [set, setSet] = useState<{ name: string; templates: { id: string }[]; colorVariants?: { name: string; hex: string }[] } | null>(null)
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [outputMode, setOutputMode] = useState<'original' | 'transparent' | 'solid'>('original')
  const [outputColor, setOutputColor] = useState('#ffffff')
  const [batchNote, setBatchNote] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState<number>(0)
  const [finalElapsed, setFinalElapsed] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    api.getDesigns().then(setDesigns)
    api.getSet(setId).then(setSet)
  }, [setId])

  // Tick the timer while rendering
  useEffect(() => {
    if (rendering && startTime !== null) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime)
      }, 100)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [rendering, startTime])

  const handleUploadDesign = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const design = await api.uploadDesign(file)
    setDesigns((prev) => [design, ...prev])
    setSelectedDesign(design.id)
  }

  const toggleColor = (hex: string) => {
    setSelectedColors((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex]
    )
  }

  const templateCount = set?.templates?.length ?? 0
  const colorCount = selectedColors.length
  const totalRenders = templateCount * Math.max(colorCount, 1)

  const handleRender = async () => {
    if (!selectedDesign) return
    setRendering(true)
    setRenders([])
    setFinalElapsed(null)
    const now = Date.now()
    setStartTime(now)
    setElapsed(0)

    const colors = selectedColors.length > 0 ? selectedColors : undefined
    const result = await api.batchRender(
      setId, selectedDesign, colors,
      outputMode !== 'original' ? outputMode : undefined,
      outputMode === 'solid' ? outputColor : undefined,
      batchNote.trim() || undefined
    )
    setBatchId(result.batchId)

    const batch = await api.getBatch(result.batchId)
    setRenders(batch.renders)

    pollRef.current = setInterval(async () => {
      const updated = await api.getBatch(result.batchId)
      setRenders(updated.renders)
      const allDone = updated.renders.every((r: RenderStatus) => r.status === 'complete' || r.status === 'failed')
      if (allDone) {
        clearInterval(pollRef.current)
        const total = Date.now() - now
        setFinalElapsed(total)
        setElapsed(total)
        setRendering(false)
      }
    }, 2000)
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const completedRenders = renders.filter((r) => r.status === 'complete')

  const openLightbox = (idx: number) => setLightboxIndex(idx)
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
      <nav className="flex items-center text-sm text-gray-400 mb-2">
        <Link href="/sets" className="hover:text-white transition-colors">My Sets</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <Link href={`/sets/${setId}`} className="hover:text-white transition-colors">{set?.name || 'Set'}</Link>
        <ChevronRight className="w-4 h-4 mx-1" />
        <span className="text-gray-300">Apply Design</span>
      </nav>
      <h1 className="text-2xl font-bold mb-1">Apply Design to {set?.name || 'Set'}</h1>
      <p className="text-sm text-gray-400 mb-6">{set?.templates?.length || 0} template{set?.templates?.length === 1 ? '' : 's'} in this set</p>

      {/* Step 1: Select design */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold">1. Select a Design</h2>
          <button onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <Upload size={14} /> Upload new
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleUploadDesign} />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {designs.map((d) => (
            <button key={d.id} onClick={() => setSelectedDesign(d.id)}
              className={`rounded-lg border-2 overflow-hidden ${selectedDesign === d.id ? 'border-blue-600' : 'border-transparent'}`}>
              <img src={`/uploads/${d.imagePath}`} alt={d.name}
                className="w-full aspect-square object-cover" />
              <p className="text-xs p-1 truncate">{d.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Colors */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">2. Select Colors (optional)</h2>
        {set?.colorVariants && set.colorVariants.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {set.colorVariants.map((cv) => (
                <button
                  key={cv.hex}
                  onClick={() => toggleColor(cv.hex)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    selectedColors.includes(cv.hex)
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                    style={{ backgroundColor: cv.hex }}
                  />
                  {cv.name}
                </button>
              ))}
            </div>
            {colorCount > 0 && templateCount > 0 && (
              <p className="text-sm text-gray-500">
                {templateCount} template{templateCount !== 1 ? 's' : ''} &times; {colorCount} color{colorCount !== 1 ? 's' : ''} = {totalRenders} mockups
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">No color variants defined. Add them on the set detail page.</p>
        )}
      </div>

      {/* Step 3: Output Mode */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">3. Output Mode</h2>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'original' as const, label: 'Original (keep background)' },
            { value: 'transparent' as const, label: 'Transparent (PNG with alpha)' },
            { value: 'solid' as const, label: 'Solid Color' },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOutputMode(opt.value)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                outputMode === opt.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {outputMode === 'solid' && (
          <div className="flex items-center gap-2 mt-3">
            <label className="text-sm text-gray-600">Background color:</label>
            <input
              type="color"
              value={outputColor}
              onChange={(e) => setOutputColor(e.target.value)}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            />
            <span className="text-xs text-gray-400 font-mono">{outputColor}</span>
          </div>
        )}
      </div>

      {/* Step 4: Render */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">4. Render Mockups</h2>
        <input
          value={batchNote}
          onChange={(e) => setBatchNote(e.target.value)}
          placeholder="Batch note (optional), e.g. &quot;Client review round 2&quot;"
          className="rounded-lg border px-3 py-2 text-sm w-full max-w-md mb-3"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleRender} disabled={!selectedDesign || rendering}
            className="rounded-lg bg-green-600 px-6 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            {rendering && <Loader2 size={18} className="animate-spin" />}
            <ImageIcon size={18} />
            {rendering ? 'Rendering...' : 'Render All'}
          </button>
          {!selectedDesign && !rendering && (
            <span className="text-sm text-gray-400">Select a design first</span>
          )}
          {/* Timer display */}
          {(rendering || finalElapsed !== null) && (
            <span className={`flex items-center gap-1.5 text-sm font-mono ${rendering ? 'text-blue-600' : 'text-green-600'}`}>
              <Clock size={14} />
              {formatElapsed(elapsed)}
              {finalElapsed !== null && !rendering && ' total'}
            </span>
          )}
        </div>
      </div>

      {/* Step 5: Results (current batch only) */}
      {renders.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">
              5. Results
              {completedRenders.length > 0 && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {completedRenders.length} of {renders.length} complete
                </span>
              )}
            </h2>
            {completedRenders.length > 0 && batchId && selectedDesign && (
              <a href={api.getZipUrl(setId, selectedDesign)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 flex items-center gap-2 text-sm w-fit">
                <Download size={16} /> Download All ({completedRenders.length})
              </a>
            )}
          </div>

          {completedRenders.length > 0 && (
            <p className="text-sm text-gray-500 mb-4 hidden sm:block">
              Click any image to view full size. Use arrow keys to navigate.
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {renders.map((r) => {
              const completedIdx = completedRenders.findIndex((cr) => cr.id === r.id)
              return (
                <div key={r.id} className="rounded-xl border bg-white overflow-hidden">
                  {r.status === 'complete' ? (
                    <button onClick={() => openLightbox(completedIdx)} className="w-full cursor-zoom-in">
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
                      <div className="flex items-center gap-1.5">
                        {r.renderOptions?.tintColor && (
                          <span
                            className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                            style={{ backgroundColor: r.renderOptions.tintColor }}
                            title={r.renderOptions.tintColor}
                          />
                        )}
                        <p className="text-xs sm:text-sm truncate">{r.mockupTemplate?.name ?? 'Rendering...'}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="capitalize">{r.status}</span>
                        {r.mockupTemplate?.overlayConfig && (
                          <>
                            <span className="hidden sm:inline">D:{Math.round((r.mockupTemplate.overlayConfig.displacementIntensity ?? 0) * 100)}%</span>
                            {(r.mockupTemplate.overlayConfig.transparency ?? 0) > 0 && (
                              <span className="hidden sm:inline">T:{Math.round((r.mockupTemplate.overlayConfig.transparency ?? 0) * 100)}%</span>
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
        </div>
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

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-4 py-2 rounded-lg flex items-center gap-3 max-w-[90vw]">
            <span className="truncate">{completedRenders[lightboxIndex].mockupTemplate?.name}</span>
            <a href={api.getDownloadUrl(completedRenders[lightboxIndex].id)} download
              onClick={(e) => e.stopPropagation()}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0">
              <Download size={14} /> Download
            </a>
          </div>

          {lightboxIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); navigateLightbox(-1) }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2">
              <ChevronLeft size={36} />
            </button>
          )}

          {lightboxIndex < completedRenders.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); navigateLightbox(1) }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2">
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
