'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Upload, Download, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Design {
  id: string
  name: string
  imagePath: string
}

interface RenderStatus {
  id: string
  status: string
  mockupTemplate: { name: string }
  renderedImagePath: string
}

export default function ApplyDesignPage() {
  const { id: setId } = useParams<{ id: string }>()
  const [designs, setDesigns] = useState<Design[]>([])
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null)
  const [renders, setRenders] = useState<RenderStatus[]>([])
  const [rendering, setRendering] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    api.getDesigns().then(setDesigns)
  }, [])

  const handleUploadDesign = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const design = await api.uploadDesign(file)
    setDesigns((prev) => [design, ...prev])
    setSelectedDesign(design.id)
  }

  const handleRender = async () => {
    if (!selectedDesign) return
    setRendering(true)
    const result = await api.batchRender(setId, selectedDesign)
    setRenders(result.renders)

    pollRef.current = setInterval(async () => {
      const status = await api.getRenderStatus(setId, selectedDesign)
      setRenders(status)
      const allDone = status.every((r: RenderStatus) => r.status === 'complete' || r.status === 'failed')
      if (allDone) {
        clearInterval(pollRef.current)
        setRendering(false)
      }
    }, 2000)
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Apply Design</h1>

      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold">Select a Design</h2>
          <button onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <Upload size={14} /> Upload new
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleUploadDesign} />
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {designs.map((d) => (
            <button key={d.id} onClick={() => setSelectedDesign(d.id)}
              className={`rounded-lg border-2 overflow-hidden ${selectedDesign === d.id ? 'border-blue-600' : 'border-transparent'}`}>
              <img src={`${API_URL}/api/mockup-sets/uploads/${d.imagePath}`} alt={d.name}
                className="w-full aspect-square object-cover" />
              <p className="text-xs p-1 truncate">{d.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={handleRender} disabled={!selectedDesign || rendering}
          className="rounded-lg bg-green-600 px-6 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
          {rendering && <Loader2 size={18} className="animate-spin" />}
          {rendering ? 'Rendering...' : 'Render All'}
        </button>
        {renders.some((r) => r.status === 'complete') && selectedDesign && (
          <a href={api.getZipUrl(setId, selectedDesign)}
            className="rounded-lg border px-6 py-2 font-medium hover:bg-gray-50 flex items-center gap-2">
            <Download size={18} /> Download ZIP
          </a>
        )}
      </div>

      {renders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {renders.map((r) => (
            <div key={r.id} className="rounded-xl border bg-white overflow-hidden">
              {r.status === 'complete' ? (
                <img src={api.getDownloadUrl(r.id)} alt={r.mockupTemplate.name}
                  className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
                  {r.status === 'failed' ? (
                    <span className="text-red-500 text-sm">Failed</span>
                  ) : (
                    <Loader2 className="animate-spin text-gray-400" />
                  )}
                </div>
              )}
              <div className="p-2">
                <p className="text-sm truncate">{r.mockupTemplate.name}</p>
                <p className="text-xs text-gray-400 capitalize">{r.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
