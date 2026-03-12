'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, Search, Tag as TagIcon } from 'lucide-react'

interface Tag {
  id: string
  name: string
  usageCount: number
}

interface TagFilterProps {
  activeTags: string[]
  onTagsChange: (tags: string[]) => void
}

export function TagFilter({ activeTags, onTagsChange }: TagFilterProps) {
  const [popularTags, setPopularTags] = useState<Tag[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.getPopularTags().then((data) => setPopularTags(data.tags)).catch(() => {})
  }, [])

  const fetchSuggestions = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSuggestions([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await api.getTags(query)
        setSuggestions(data.tags.filter((t: Tag) => !activeTags.includes(t.name)))
      } catch { setSuggestions([]) }
    }, 200)
  }, [activeTags])

  const toggleTag = (name: string) => {
    if (activeTags.includes(name)) {
      onTagsChange(activeTags.filter((t) => t !== name))
    } else {
      onTagsChange([...activeTags, name])
    }
  }

  const addFromSearch = (name: string) => {
    if (!activeTags.includes(name)) {
      onTagsChange([...activeTags, name])
    }
    setSearchInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <TagIcon size={14} className="text-gray-400 shrink-0 mr-0.5" />
        {popularTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.name)}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              activeTags.includes(tag.name)
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {tag.name}
          </button>
        ))}
        <div className="relative ml-1">
          <div className="relative">
            <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); fetchSuggestions(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (suggestions.length) setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchInput.trim()) { addFromSearch(searchInput.trim().toLowerCase()) }
                if (e.key === 'Escape') { setShowSuggestions(false); setSearchInput('') }
              }}
              placeholder="Search tags..."
              className="pl-5 pr-2 py-0.5 text-xs border border-gray-200 rounded-full w-28 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-48 max-h-32 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="flex items-center justify-between w-full px-2 py-1 hover:bg-blue-50 text-xs text-left"
                  onMouseDown={(e) => { e.preventDefault(); addFromSearch(s.name) }}
                >
                  <span>{s.name}</span>
                  <span className="text-gray-400">{s.usageCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {activeTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">Filtered by:</span>
          {activeTags.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
              {name}
              <button onClick={() => toggleTag(name)}><X size={10} /></button>
            </span>
          ))}
          <button onClick={() => onTagsChange([])} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
