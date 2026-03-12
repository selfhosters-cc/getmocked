'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { Upload, Trash2 } from 'lucide-react'
import { UploadProgress, UploadItem } from '@/components/upload-progress'
import { useFileDrop } from '@/hooks/use-file-drop'

interface Design {
  id: string
  name: string
  imagePath: string
  createdAt: string
}

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchDesigns = useCallback(() => {
    api.getDesigns().then(setDesigns)
  }, [])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  const uploadFiles = useCallback(async (files: File[]) => {
    const items: UploadItem[] = files.map((f) => ({ name: f.name, status: 'pending' }))
    setUploads(items)
    for (let i = 0; i < files.length; i++) {
      setUploads((prev) => prev.map((item, j) => (j === i ? { ...item, status: 'uploading' } : item)))
      try {
        await api.uploadDesign(files[i])
        setUploads((prev) => prev.map((item, j) => (j === i ? { ...item, status: 'done' } : item)))
      } catch {
        setUploads((prev) => prev.map((item, j) => (j === i ? { ...item, status: 'error', error: 'Upload failed' } : item)))
      }
    }
    fetchDesigns()
  }, [fetchDesigns])

  const { isDragging, dropProps } = useFileDrop(uploadFiles)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (fileInput.current) fileInput.current.value = ''
    uploadFiles(Array.from(files))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this design?')) return
    await api.deleteDesign(id)
    setDesigns((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div {...dropProps} className="relative min-h-[calc(100vh-6rem)]">
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/10 border-4 border-dashed border-blue-400 rounded-xl z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-8 py-6 shadow-lg text-center">
            <Upload size={32} className="mx-auto text-blue-500 mb-2" />
            <p className="text-lg font-medium text-blue-700">Drop designs to upload</p>
          </div>
        </div>
      )}
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
      <UploadProgress items={uploads} onDismiss={() => setUploads([])} />
    </div>
  )
}
