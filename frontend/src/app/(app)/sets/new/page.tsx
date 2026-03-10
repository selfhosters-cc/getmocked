'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function NewSetPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const set = await api.createSet({ name, description: description || undefined })
    router.push(`/sets/${set.id}`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Create Mockup Set</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Black T-Shirt - 5 Angles" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" rows={3}
            placeholder="Notes about this mockup set..." />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700">
          Create Set
        </button>
      </form>
    </div>
  )
}
