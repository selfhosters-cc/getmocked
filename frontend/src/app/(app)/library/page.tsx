'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Upload, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ImageOff, Check, X, Crop, Star } from 'lucide-react'
import { ImageEditorModal } from '@/components/image-editor-modal'
import { UploadProgress, UploadItem } from '@/components/upload-progress'
import { useFileDrop } from '@/hooks/use-file-drop'

interface TemplateLink {
  templateId: string
  setId: string
  renderCount: number
}

interface TemplateImage {
  id: string
  name: string
  imagePath: string
  thumbnailPath: string | null
  setCount: number
  renderCount: number
  rating: number
  templateLinks: TemplateLink[]
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
  const [editingImage, setEditingImage] = useState<{ id: string; imagePath: string } | null>(null)
  const [sort, setSort] = useState('newest')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async (p: number, s?: string) => {
    setLoading(true)
    try {
      const data = await api.getTemplateImages(p, s)
      setImages(data.images)
      setTotal(data.total)
      setPage(data.page)
      if (data.pageSize) setPageSize(data.pageSize)
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadFiles = useCallback(async (files: File[]) => {
    const items: UploadItem[] = files.map((f) => ({ name: f.name, status: 'pending' }))
    setUploads(items)
    for (let i = 0; i < files.length; i++) {
      setUploads((prev) => prev.map((item, j) => (j === i ? { ...item, status: 'uploading' } : item)))
      try {
        await api.uploadTemplateImage(files[i])
        setUploads((prev) => prev.map((item, j) => (j === i ? { ...item, status: 'done' } : item)))
      } catch {
        setUploads((prev) => prev.map((item, j) => (j === i ? { ...item, status: 'error', error: 'Upload failed' } : item)))
      }
    }
    fetchImages(page, sort)
  }, [fetchImages, page, sort])

  const { isDragging, dropProps } = useFileDrop(uploadFiles)

  useEffect(() => {
    fetchImages(1, sort)
    api.getSets().then(setSets)
  }, [fetchImages, sort])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (fileInput.current) fileInput.current.value = ''
    uploadFiles(Array.from(files))
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this template image?')) return
    await api.archiveTemplateImage(id)
    fetchImages(page, sort)
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
    fetchImages(page, sort)
  }

  const totalPages = Math.ceil(total / pageSize)

  const handleRate = async (id: string, rating: number) => {
    await api.updateTemplateImage(id, { rating })
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, rating } : img)))
  }

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'name_asc', label: 'Name A-Z' },
    { value: 'name_desc', label: 'Name Z-A' },
    { value: 'top_rated', label: 'Top Rated' },
    { value: 'most_renders', label: 'Most Renders' },
    { value: 'most_sets', label: 'Most Sets' },
  ]

  const handleSort = (s: string) => {
    setSort(s)
    fetchImages(1, s)
  }

  return (
    <div {...dropProps} className="relative">
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/10 border-4 border-dashed border-blue-400 rounded-xl z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-8 py-6 shadow-lg text-center">
            <Upload size={32} className="mx-auto text-blue-500 mb-2" />
            <p className="text-lg font-medium text-blue-700">Drop images to upload</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
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

      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 mr-1">Sort:</span>
        {sortOptions.map((opt) => (
          <button key={opt.value} onClick={() => handleSort(opt.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              sort === opt.value
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}>
            {opt.label}
          </button>
        ))}
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
                    {img.renderCount > 0 && img.templateLinks.length > 0 ? (
                      <Link
                        href={`/sets/${img.templateLinks[0].setId}/templates/${img.templateLinks[0].templateId}/renders`}
                        className="text-blue-500 hover:text-blue-700 hover:underline"
                      >
                        {img.renderCount} render{img.renderCount !== 1 ? 's' : ''}
                      </Link>
                    ) : (
                      <span>{img.renderCount} render{img.renderCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(img.id, img.rating === star ? 0 : star)}
                        className="p-0"
                        title={img.rating === star ? 'Clear rating' : `Rate ${star}`}
                      >
                        <Star
                          size={14}
                          className={star <= img.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingImage({ id: img.id, imagePath: img.imagePath })}
                    className="rounded-full bg-white p-2 shadow hover:bg-blue-50"
                    title="Edit image"
                  >
                    <Crop size={14} className="text-blue-600" />
                  </button>
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
                onClick={() => fetchImages(page - 1, sort)}
                disabled={page <= 1}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchImages(page + 1, sort)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {editingImage && (
        <ImageEditorModal
          imageId={editingImage.id}
          imagePath={editingImage.imagePath}
          onClose={() => setEditingImage(null)}
          onSaved={() => { setEditingImage(null); fetchImages(page, sort) }}
        />
      )}
      <UploadProgress items={uploads} onDismiss={() => setUploads([])} />
    </div>
  )
}
