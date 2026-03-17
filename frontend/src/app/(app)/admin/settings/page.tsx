'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Loader2, Save, Settings } from 'lucide-react'

interface SystemSetting {
  key: string
  value: string
  updatedAt: string
}

export default function AdminSettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [renderLimit, setRenderLimit] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    api.getAdminSettings()
      .then((data: { settings: SystemSetting[] }) => {
        const rl = data.settings.find(s => s.key === 'render_limit')
        setRenderLimit(rl ? rl.value : '500')
      })
      .catch((err: Error) => {
        if (err.message.includes('Not authorized') || err.message.includes('Not authenticated')) {
          router.push('/dashboard')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const saveRenderLimit = async () => {
    const parsed = parseInt(renderLimit, 10)
    if (isNaN(parsed) || parsed < 0) {
      setMessage({ type: 'error', text: 'Please enter a valid number' })
      return
    }
    setSaving('render_limit')
    setMessage(null)
    try {
      await api.updateAdminSetting('render_limit', String(parsed))
      setMessage({ type: 'success', text: 'Render limit updated' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to update setting' })
    } finally {
      setSaving(null)
    }
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
      <div className="flex items-center gap-3 mb-8">
        <Settings size={24} className="text-gray-500" />
        <h1 className="text-2xl font-bold">Admin Settings</h1>
      </div>

      <div className="rounded-xl border bg-white p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Render Limits</h2>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Max renders per user
        </label>
        <div className="flex gap-3">
          <input
            type="number"
            min="0"
            value={renderLimit}
            onChange={(e) => setRenderLimit(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={saveRenderLimit}
            disabled={saving === 'render_limit'}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving === 'render_limit' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save
          </button>
        </div>

        {message && (
          <p className={`text-sm mt-2 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Changes take effect immediately for all users. Current value applies to all render requests in real-time.
        </p>
      </div>
    </div>
  )
}
