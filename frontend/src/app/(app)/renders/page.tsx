'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Download } from 'lucide-react'

interface MockupSet {
  id: string
  name: string
  templates: { id: string }[]
}

export default function RendersPage() {
  const [sets, setSets] = useState<MockupSet[]>([])

  useEffect(() => {
    api.getSets().then(setSets)
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Renders</h1>
      <p className="text-gray-500">Select a mockup set to apply a design and generate renders.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {sets.map((set) => (
          <a key={set.id} href={`/sets/${set.id}/apply`}
            className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow">
            <h3 className="font-semibold">{set.name}</h3>
            <p className="text-gray-400 text-sm mt-1">{set.templates.length} template(s)</p>
            <div className="mt-3 flex items-center gap-1 text-blue-600 text-sm">
              <Download size={14} /> Apply design & render
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
