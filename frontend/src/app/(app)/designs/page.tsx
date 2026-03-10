'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Upload, Trash2 } from 'lucide-react'

interface Design {
  id: string
  name: string
  imagePath: string
  createdAt: string
}

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getDesigns().then(setDesigns)
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      const design = await api.uploadDesign(file)
      setDesigns((prev) => [design, ...prev])
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this design?')) return
    await api.deleteDesign(id)
    setDesigns((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Designs</h1>
        <button onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Upload size={20} /> Upload Design
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {designs.map((d) => (
          <div key={d.id} className="group relative rounded-xl border bg-white overflow-hidden">
            <img src={`/uploads/${d.imagePath}`} alt={d.name}
              className="w-full aspect-square object-cover" />
            <div className="p-2">
              <p className="text-sm truncate">{d.name}</p>
            </div>
            <button onClick={() => handleDelete(d.id)}
              className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 rounded-full bg-white p-2 shadow hover:bg-red-50 transition-opacity">
              <Trash2 size={14} className="text-red-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
