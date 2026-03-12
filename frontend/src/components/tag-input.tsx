'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, Plus, Trash2 } from 'lucide-react'

interface Tag {
  id: string
  name: string
}

interface TagInputProps {
  tags: Tag[]
  onAdd: (name: string) => void
  onRemove: (tagId: string) => void
  isAdmin?: boolean
  onAdminArchive?: (tagId: string) => void
}

export function TagInput({ tags, onAdd, onRemove, isAdmin, onAdminArchive }: TagInputProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; usageCount: number }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus()
  }, [isAdding])

  const fetchSuggestions = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSuggestions([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await api.getTags(query)
        setSuggestions(data.tags.filter((t: Tag) => !tags.some((existing) => existing.id === t.id)))
      } catch { setSuggestions([]) }
    }, 200)
  }, [tags])

  const handleAdd = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setInputValue('')
    setSuggestions([])
    setIsAdding(false)
  }

  if (!isAdding) {
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
            {tag.name}
            <button onClick={(e) => { e.stopPropagation(); onRemove(tag.id) }} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); setIsAdding(true) }}
          className="p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Add tag"
        >
          <Plus size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
            {tag.name}
            <button onClick={(e) => { e.stopPropagation(); onRemove(tag.id) }} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(inputValue) }
            if (e.key === 'Escape') { setIsAdding(false); setInputValue('') }
          }}
          onBlur={() => setTimeout(() => { setShowSuggestions(false); if (!inputValue) setIsAdding(false) }, 200)}
          placeholder="Add tag..."
          className="text-xs border rounded px-1.5 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-48 max-h-32 overflow-y-auto">
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-2 py-1 hover:bg-blue-50 cursor-pointer text-xs"
              onMouseDown={(e) => { e.preventDefault(); handleAdd(s.name) }}>
              <span>{s.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">{s.usageCount}</span>
                {isAdmin && onAdminArchive && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAdminArchive(s.id) }}
                    className="p-0.5 hover:text-red-500 text-gray-300"
                    title="Archive tag"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
