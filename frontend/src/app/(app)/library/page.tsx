'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { Upload, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ImageOff, Check, X } from 'lucide-react'

interface TemplateImage {
  id: string
  name: string
  imagePath: string
  thumbnailPath: string | null
  setCount: number
  renderCount: number
  createdAt: string
}

interface MockupSet {
  id: string
  name: string
}

const getThumbnailUrl = (img: TemplateImage) =>
  img.thumbnailPath ? `/uploads/${img.thumbnailPath}` : `/api/thumbnails/${img.imagePath}`

export default function LibraryPage() {
  const [images, setImages] = useState<TemplateImage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [sets, setSets] = useState<MockupSet[]>([])
  const [addToSetId, setAddToSetId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const data = await api.getTemplateImages(p)
      setImages(data.images)
      setTotal(data.total)
      setPage(data.page)
      if (data.pageSize) setPageSize(data.pageSize)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImages(1)
    api.getSets().then(setSets)
  }, [fetchImages])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      await api.uploadTemplateImage(file)
    }
    if (fileInput.current) fileInput.current.value = ''
    fetchImages(page)
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this template image?')) return
    await api.archiveTemplateImage(id)
    fetchImages(page)
  }

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return
    await api.updateTemplateImage(id, { name: renameValue.trim() })
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, name: renameValue.trim() } : img)))
    setRenamingId(null)
  }

  const handleAddToSet = async (templateImageId: string, setId: string) => {
    await api.addTemplateToSet(setId, templateImageId)
    setAddToSetId(null)
    fetchImages(page)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Library</h1>
          <p className="text-sm text-gray-500 mt-1">{total} template{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
        >
          <Upload size={20} /> Upload
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      {loading && images.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-400">Loading...</div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ImageOff size={48} className="mb-4" />
          <p className="text-lg font-medium">No template images yet</p>
          <p className="text-sm mt-1">Upload images to build your library</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.id} className="group relative rounded-xl border bg-white overflow-hidden">
                <img
                  src={getThumbnailUrl(img)}
                  alt={img.name}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <div className="p-2">
                  {renamingId === img.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(img.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="text-sm border rounded px-1 py-0.5 flex-1 min-w-0"
                        autoFocus
                      />
                      <button onClick={() => handleRename(img.id)} className="p-0.5 hover:bg-green-50 rounded">
                        <Check size={14} className="text-green-600" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="p-0.5 hover:bg-gray-100 rounded">
                        <X size={14} className="text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm truncate">{img.name}</p>
                  )}
                  <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                    <span>{img.setCount} set{img.setCount !== 1 ? 's' : ''}</span>
                    <span>{img.renderCount} render{img.renderCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setAddToSetId(addToSetId === img.id ? null : img.id)}
                    className="rounded-full bg-white p-2 shadow hover:bg-blue-50"
                    title="Add to Set"
                  >
                    <Plus size={14} className="text-blue-600" />
                  </button>
                  <button
                    onClick={() => {
                      setRenamingId(img.id)
                      setRenameValue(img.name)
                    }}
                    className="rounded-full bg-white p-2 shadow hover:bg-gray-50"
                    title="Rename"
                  >
                    <Pencil size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleArchive(img.id)}
                    className="rounded-full bg-white p-2 shadow hover:bg-red-50"
                    title="Archive"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>

                {/* Add to Set overlay */}
                {addToSetId === img.id && (
                  <div className="absolute inset-x-0 bottom-0 bg-white border-t shadow-lg p-3 z-10">
                    <p className="text-xs font-medium mb-2">Add to Set</p>
                    {sets.length === 0 ? (
                      <p className="text-xs text-gray-400">No sets available</p>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {sets.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleAddToSet(img.id, s.id)}
                            className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-blue-50 truncate"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setAddToSetId(null)}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => fetchImages(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchImages(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
