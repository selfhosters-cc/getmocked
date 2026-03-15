'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plug, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'

interface Connection {
  id: string
  shopId: string
  shopName: string
  status: 'connected' | 'needs_reauth'
  createdAt: string
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const error = searchParams.get('error')

  useEffect(() => {
    loadConnections()
  }, [])

  async function loadConnections() {
    try {
      const data = await api.getEtsyConnections()
      setConnections(data.connections)
    } catch (err) {
      console.error('Failed to load connections:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm('Disconnect this shop? Upload history will be preserved.')) return
    setDeleting(id)
    try {
      await api.deleteEtsyConnection(id)
      setConnections((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error('Failed to disconnect:', err)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Connections</h1>
        <a
          href="/api/etsy/connect"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plug size={16} />
          Connect Etsy Shop
        </a>
      </div>

      {success === 'connected' && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4">
          <CheckCircle size={16} />
          Shop connected successfully!
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">
          <AlertCircle size={16} />
          {error === 'invalid_state' ? 'OAuth session expired. Please try again.' :
           error === 'oauth_failed' ? 'Failed to connect to Etsy. Please try again.' :
           'An error occurred.'}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Plug size={48} className="mx-auto mb-3 opacity-50" />
          <p>No shops connected yet.</p>
          <p className="text-sm mt-1">Connect your Etsy shop to push mockups directly to your listings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map((conn) => (
            <div key={conn.id} className="group rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <span className="text-orange-600 font-bold text-sm">E</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{conn.shopName}</h3>
                    <p className="text-xs text-gray-400">Etsy Shop</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  disabled={deleting === conn.id}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                >
                  {deleting === conn.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Connected {new Date(conn.createdAt).toLocaleDateString()}
                </span>
                {conn.status === 'needs_reauth' ? (
                  <a
                    href="/api/etsy/connect"
                    className="flex items-center gap-1 text-orange-500 hover:text-orange-600"
                  >
                    <AlertCircle size={12} />
                    Reconnect
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle size={12} />
                    Active
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
