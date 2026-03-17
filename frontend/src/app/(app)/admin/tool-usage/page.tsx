'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Loader2, BarChart3 } from 'lucide-react'

interface ToolCount {
  tool: string
  count: number
}

interface RecentEntry {
  id: string
  tool: string
  userId: string | null
  createdAt: string
}

interface ToolUsageData {
  allTime: ToolCount[]
  last24h: ToolCount[]
  last7d: ToolCount[]
  recent: RecentEntry[]
}

export default function AdminToolUsagePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ToolUsageData | null>(null)

  useEffect(() => {
    api.getAdminToolUsage()
      .then((result: ToolUsageData) => {
        setData(result)
      })
      .catch((err: Error) => {
        if (err.message.includes('Not authorized') || err.message.includes('Not authenticated')) {
          router.push('/dashboard')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        Failed to load tool usage data.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 size={24} className="text-gray-500" />
        <h1 className="text-2xl font-bold">Tool Usage</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard title="All Time" stats={data.allTime} />
        <StatsCard title="Last 7 Days" stats={data.last7d} />
        <StatsCard title="Last 24 Hours" stats={data.last24h} />
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Tool</th>
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{entry.tool}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      {entry.userId ? 'Authenticated' : 'Anonymous'}
                    </td>
                    <td className="py-2 text-gray-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatsCard({ title, stats }: { title: string; stats: ToolCount[] }) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {stats.length === 0 ? (
        <p className="text-sm text-gray-500">No usage data.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Tool</th>
              <th className="pb-2 text-right font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => (
              <tr key={row.tool} className="border-b last:border-0">
                <td className="py-2 font-medium">{row.tool}</td>
                <td className="py-2 text-right text-gray-600">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
