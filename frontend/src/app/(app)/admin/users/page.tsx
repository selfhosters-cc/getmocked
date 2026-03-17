'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Loader2, Users, RotateCcw } from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  name: string | null
  authProvider: string
  isAdmin: boolean
  renderCountOffset: number
  createdAt: string
  totalRenders: number
  effectiveRenders: number
  _count: {
    mockupSets: number
    designs: number
    renderBatches: number
  }
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [resetting, setResetting] = useState<string | null>(null)

  const fetchUsers = () => {
    api.getAdminUsers()
      .then((data: { users: AdminUser[] }) => setUsers(data.users))
      .catch((err: Error) => {
        if (err.message.includes('Not authorized') || err.message.includes('Not authenticated')) {
          router.push('/dashboard')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [router])

  const handleReset = async (userId: string) => {
    if (!confirm('Reset this user\'s render count to 0?')) return
    setResetting(userId)
    try {
      await api.resetUserRenders(userId)
      fetchUsers() // Refresh the list
    } catch {
      alert('Failed to reset render count')
    } finally {
      setResetting(null)
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
        <Users size={24} className="text-gray-500" />
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Auth</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Sets</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Designs</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Renders Used</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Joined</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.email}</div>
                  {u.name && <div className="text-xs text-gray-500">{u.name}</div>}
                  {u.isAdmin && (
                    <span className="inline-block mt-0.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{u.authProvider}</td>
                <td className="px-4 py-3 text-right text-gray-700">{u._count.mockupSets}</td>
                <td className="px-4 py-3 text-right text-gray-700">{u._count.designs}</td>
                <td className="px-4 py-3 text-right">
                  <span className="font-medium text-gray-900">{u.effectiveRenders}</span>
                  <span className="text-gray-400 text-xs ml-1">({u.totalRenders} total)</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleReset(u.id)}
                    disabled={resetting === u.id || u.effectiveRenders === 0}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Reset render count to 0"
                  >
                    {resetting === u.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center py-8 text-gray-400">No users found</p>
        )}
      </div>
    </div>
  )
}
