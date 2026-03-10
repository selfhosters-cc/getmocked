'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Loader2, Trash2, ImageDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface BatchSummary {
  id: string
  createdAt: string
  mockupSet: { id: string; name: string }
  design: { id: string; name: string; imagePath: string }
  totalRenders: number
  completedRenders: number
  failedRenders: number
  previewImages: string[]
}

export default function RendersPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchPage = (p: number) => {
    setLoading(true)
    api.getBatches(p)
      .then((data: { batches: BatchSummary[]; page: number; totalPages: number; total: number }) => {
        setBatches(data.batches)
        setPage(data.page)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPage(1)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this batch and all its renders?')) return
    setDeleting(id)
    await api.deleteBatch(id)
    // Refresh current page (may shift items)
    fetchPage(page)
    setDeleting(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Render Batches
          {total > 0 && <span className="text-sm font-normal text-gray-400 ml-2">({total})</span>}
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : batches.length === 0 && page === 1 ? (
        <div className="text-center py-16 text-gray-400">
          <ImageDown size={48} className="mx-auto mb-3 opacity-50" />
          <p>No render batches yet.</p>
          <p className="text-sm mt-1">Go to a mockup set and apply a design to create one.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((b) => {
              const allDone = b.completedRenders + b.failedRenders === b.totalRenders
              return (
                <div key={b.id} className="group rounded-xl border bg-white overflow-hidden">
                  <Link href={`/renders/${b.id}`}>
                    {b.previewImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-px bg-gray-100">
                        {b.previewImages.slice(0, 3).map((path, i) => (
                          <img key={i} src={`/rendered/${path}`} alt={`Render preview ${i + 1}`}
                            className="w-full aspect-square object-cover" />
                        ))}
                        {b.previewImages.length < 3 && Array.from({ length: 3 - b.previewImages.length }).map((_, i) => (
                          <div key={`empty-${i}`} className="w-full aspect-square bg-gray-50" />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32 bg-gray-50 text-gray-300">
                        <ImageDown size={32} />
                      </div>
                    )}
                  </Link>
                  <div className="p-4">
                    <Link href={`/renders/${b.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{b.mockupSet.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <img src={`/uploads/${b.design.imagePath}`} alt={b.design.name}
                          className="w-5 h-5 rounded object-cover shrink-0" />
                        <span className="text-sm text-gray-500 truncate">{b.design.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                        <span>{formatDate(b.createdAt)}</span>
                        <span>
                          {b.completedRenders}/{b.totalRenders}
                          {b.failedRenders > 0 && (
                            <span className="text-red-400 ml-1">({b.failedRenders} failed)</span>
                          )}
                        </span>
                        {!allDone && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Loader2 size={12} className="animate-spin" />
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deleting === b.id}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Delete batch">
                        {deleting === b.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
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
                        onClick={() => fetchPage(item)}
                        className={`min-w-[2.25rem] rounded-lg px-3 py-2 text-sm ${
                          item === page
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
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
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
