'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Plus, Layers } from 'lucide-react'

export default function DashboardPage() {
  const [sets, setSets] = useState<Array<{ id: string; name: string; description?: string; templates: unknown[] }>>([])

  useEffect(() => {
    api.getSets().then(setSets).catch(console.error)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/sets/new" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Plus size={20} /> New Mockup Set
        </Link>
      </div>

      {sets.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Layers size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No mockup sets yet</p>
          <p className="text-sm">Create your first set to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map((set) => (
            <Link key={set.id} href={`/sets/${set.id}`}
              className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg">{set.name}</h3>
              {set.description && <p className="text-gray-500 text-sm mt-1">{set.description}</p>}
              <p className="text-gray-400 text-sm mt-2">{set.templates.length} template(s)</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
