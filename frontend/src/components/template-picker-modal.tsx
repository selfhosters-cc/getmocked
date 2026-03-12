'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, Check, Search } from 'lucide-react'

interface TemplateImage {
  id: string
  name: string
  imagePath: string
  thumbnailPath: string | null
}

interface PageResult {
  images: TemplateImage[]
  total: number
  page: number
  pageSize: number
}

const getThumbnailUrl = (img: TemplateImage) =>
  img.thumbnailPath ? `/uploads/${img.thumbnailPath}` : `/api/thumbnails/${img.imagePath}`

export function TemplatePickerModal({
  setId,
  onClose,
  onAdded,
}: {
  setId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [tab, setTab] = useState<'library' | 'site'>('library')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  const fetchData = useCallback(() => {
    setData(null)
    if (tab === 'library') {
      api.getTemplateImages(page).then(setData)
    } else {
      api.getSiteTemplates(page, search || undefined).then(setData)
    }
  }, [tab, page, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when tab or search changes
  useEffect(() => {
    setPage(1)
  }, [tab, search])

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async () => {
    if (selected.size === 0) return
    setAdding(true)
    try {
      for (const templateImageId of selected) {
        await api.addTemplateToSet(setId, templateImageId)
      }
      onAdded()
      onClose()
    } catch (err) {
      console.error('Failed to add templates:', err)
    } finally {
      setAdding(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add Templates</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="inline-flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setTab('library')}
              className={`px-4 py-2 text-sm font-medium ${
                tab === 'library' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              My Library
            </button>
            <button
              onClick={() => setTab('site')}
              className={`px-4 py-2 text-sm font-medium ${
                tab === 'site' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Site Templates
            </button>
          </div>

          {tab === 'site' && (
            <div className="relative mt-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!data ? (
            <div className="text-center text-gray-400 py-12">Loading...</div>
          ) : data.images.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No templates found</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {data.images.map((img) => {
                const isSelected = selected.has(img.id)
                return (
                  <button
                    key={img.id}
                    onClick={() => toggleSelection(img.id)}
                    className={`relative rounded-lg border-2 overflow-hidden text-left transition-colors ${
                      isSelected ? 'border-blue-500' : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={getThumbnailUrl(img)}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs truncate px-1.5 py-1">{img.name}</p>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded border disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm rounded border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <span className="text-sm text-gray-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || adding}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : `Add ${selected.size} Template${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
