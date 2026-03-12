'use client'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'

export interface UploadItem {
  name: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface UploadProgressProps {
  items: UploadItem[]
  onDismiss: () => void
}

export function UploadProgress({ items, onDismiss }: UploadProgressProps) {
  if (items.length === 0) return null

  const done = items.filter((i) => i.status === 'done').length
  const errors = items.filter((i) => i.status === 'error').length
  const allFinished = done + errors === items.length

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-xl shadow-lg border z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm font-medium">
          Uploading {done}/{items.length}
          {errors > 0 && <span className="text-red-500 ml-1">({errors} failed)</span>}
        </span>
        {allFinished && (
          <button onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-700">
            Dismiss
          </button>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${((done + errors) / items.length) * 100}%` }}
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-1.5 text-sm border-b last:border-b-0">
            {item.status === 'done' && <CheckCircle size={14} className="text-green-500 shrink-0" />}
            {item.status === 'error' && <XCircle size={14} className="text-red-500 shrink-0" />}
            {item.status === 'uploading' && <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />}
            {item.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />}
            <span className="truncate text-gray-700">{item.name}</span>
            {item.error && <span className="text-xs text-red-400 ml-auto shrink-0">Failed</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
