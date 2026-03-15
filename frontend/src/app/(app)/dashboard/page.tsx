'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Plus, Layers, Palette, ImageDown, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Stats {
  sets: number
  designs: number
  totalRenders: number
  completedRenders: number
  failedRenders: number
}

interface BatchPreview {
  id: string
  createdAt: string
  mockupSet: { id: string; name: string }
  design: { id: string; name: string; imagePath: string }
  totalRenders: number
  completedRenders: number
  failedRenders: number
  previewImages: string[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentBatches, setRecentBatches] = useState<BatchPreview[]>([])
  const [renderUsage, setRenderUsage] = useState<{ used: number; limit: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard()
      .then((data: { stats: Stats; recentBatches: BatchPreview[]; renderUsage: { used: number; limit: number } }) => {
        setStats(data.stats)
        setRecentBatches(data.recentBatches)
        setRenderUsage(data.renderUsage)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/sets/new" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Plus size={20} /> New Set
        </Link>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <Link href="/sets" className="rounded-xl border bg-white p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-blue-50 p-2">
                <Layers size={20} className="text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Mockup Sets</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stats.sets}</p>
          </Link>

          <Link href="/designs" className="rounded-xl border bg-white p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-purple-50 p-2">
                <Palette size={20} className="text-purple-600" />
              </div>
              <span className="text-sm text-gray-500">Designs</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stats.designs}</p>
          </Link>

          <Link href="/renders" className="rounded-xl border bg-white p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-green-50 p-2">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Renders</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stats.completedRenders}</p>
            {stats.totalRenders > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                of {stats.totalRenders} total
              </p>
            )}
          </Link>

          <div className="rounded-xl border bg-white p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-red-50 p-2">
                <XCircle size={20} className="text-red-500" />
              </div>
              <span className="text-sm text-gray-500">Failed</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stats.failedRenders}</p>
            {stats.totalRenders > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {Math.round((stats.completedRenders / stats.totalRenders) * 100)}% success rate
              </p>
            )}
          </div>
        </div>
      )}

      {renderUsage && (
        <div className="mb-8 rounded-xl border bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Render Usage</span>
            <span className="text-sm text-gray-500">{renderUsage.used} / {renderUsage.limit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                renderUsage.used / renderUsage.limit > 0.9 ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min((renderUsage.used / renderUsage.limit) * 100, 100)}%` }}
            />
          </div>
          {renderUsage.used / renderUsage.limit > 0.9 && (
            <p className="text-xs text-red-500 mt-2">
              {renderUsage.used >= renderUsage.limit
                ? 'You have reached your render limit.'
                : 'You are approaching your render limit.'}
            </p>
          )}
        </div>
      )}

      {/* Recent renders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Renders</h2>
          {recentBatches.length > 0 && (
            <Link href="/renders" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          )}
        </div>

        {recentBatches.length === 0 ? (
          <div className="text-center py-12 rounded-xl border bg-white">
            <ImageDown size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No renders yet</p>
            <p className="text-sm text-gray-400 mt-1">Go to a mockup set and apply a design to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {recentBatches.map((b) => {
              const allDone = b.completedRenders + b.failedRenders === b.totalRenders
              return (
                <Link key={b.id} href={`/renders/${b.id}`}
                  className="group rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow">
                  {b.previewImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-px bg-gray-100">
                      {b.previewImages.slice(0, 3).map((path, i) => (
                        <img key={i} src={`/rendered/${path}`} alt={`Preview ${i + 1}`}
                          className="w-full aspect-square object-cover" />
                      ))}
                      {b.previewImages.length < 3 && Array.from({ length: 3 - b.previewImages.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-full aspect-square bg-gray-50" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 bg-gray-50 text-gray-300">
                      <ImageDown size={28} />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{b.mockupSet.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <img src={`/uploads/${b.design.imagePath}`} alt={b.design.name}
                        className="w-4 h-4 rounded object-cover shrink-0" />
                      <span className="text-xs text-gray-500 truncate">{b.design.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{formatDate(b.createdAt)}</span>
                      <span className="ml-auto">
                        {b.completedRenders}/{b.totalRenders}
                      </span>
                      {!allDone && <Loader2 size={10} className="animate-spin text-blue-500" />}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions for empty states */}
      {stats && stats.sets === 0 && (
        <div className="text-center py-12 rounded-xl border bg-white">
          <Layers size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-500">Get started</p>
          <p className="text-sm text-gray-400 mb-4">Create your first mockup set to begin generating mockups.</p>
          <Link href="/sets/new" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-white font-medium hover:bg-blue-700">
            <Plus size={20} /> Create Mockup Set
          </Link>
        </div>
      )}
    </div>
  )
}
