'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Plus, Trash2 } from 'lucide-react'

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: { id: string }[]
}

export default function SetsPage() {
  const [sets, setSets] = useState<MockupSet[]>([])

  useEffect(() => {
    api.getSets().then(setSets)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mockup set?')) return
    await api.deleteSet(id)
    setSets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Mockup Sets</h1>
        <Link href="/sets/new" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Plus size={20} /> New Set
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map((set) => (
          <div key={set.id} className="rounded-xl border bg-white p-6 flex justify-between items-start">
            <Link href={`/sets/${set.id}`} className="flex-1">
              <h3 className="font-semibold">{set.name}</h3>
              {set.description && <p className="text-gray-500 text-sm mt-1">{set.description}</p>}
              <p className="text-gray-400 text-sm mt-2">{set.templates.length} template(s)</p>
            </Link>
            <button onClick={() => handleDelete(set.id)} className="text-gray-400 hover:text-red-600 ml-2">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
