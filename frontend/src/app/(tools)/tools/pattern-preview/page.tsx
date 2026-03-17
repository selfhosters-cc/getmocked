'use client'

import { useState } from 'react'
import { Download, RotateCcw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ToolLayout from '@/components/tool-layout'
import { useAuth } from '@/lib/auth-context'
import { trackToolUsage } from '@/lib/track-tool-usage'

const faq = [
  { question: 'What repeat modes are available?', answer: 'Straight (grid), Half-Drop (columns offset by half), Half-Brick (rows offset by half), and Mirror (alternating flip).' },
  { question: 'Who is this tool for?', answer: 'Fabric designers, wallpaper creators, wrapping paper sellers, and anyone who needs to preview how a design tiles as a repeating pattern.' },
  { question: 'Can I adjust the tile size?', answer: 'Yes. Use the scale slider to make tiles larger or smaller, and adjust the grid size with columns and rows controls.' },
]

type RepeatMode = 'straight' | 'half-drop' | 'half-brick' | 'mirror'

const modes: { value: RepeatMode; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'half-drop', label: 'Half-Drop' },
  { value: 'half-brick', label: 'Half-Brick' },
  { value: 'mirror', label: 'Mirror' },
]

export default function PatternPreviewPage() {
  const { user, loading } = useAuth()

  if (!user && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pattern Repeat Preview</h1>
        <p className="text-gray-600 mb-8">Preview how your design tiles as a repeating pattern. Supports straight, half-drop, half-brick, and mirror repeat modes.</p>
        <div className="bg-blue-50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Free Account Required</h2>
          <p className="text-gray-600 mb-4">Sign up for a free account to use this tool. No credit card required.</p>
          <Link href="/signup" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
            Sign Up Free
          </Link>
        </div>
        {faq.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{item.question}</h3>
                  <p className="text-sm text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
      </div>
    )
  }

  return (
    <ToolLayout
      title="Pattern Repeat Preview"
      description="Preview how your design tiles as a repeating pattern for fabric, wallpaper, or wrapping paper."
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <PatternPreviewTool file={files[0]} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function PatternPreviewTool({ file, onReset }: { file: File; onReset: () => void }) {
  const [mode, setMode] = useState<RepeatMode>('straight')
  const [scale, setScale] = useState(1.0)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [processing, setProcessing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('mode', mode)
      formData.append('cols', cols.toString())
      formData.append('rows', rows.toString())
      formData.append('scale', scale.toString())

      const res = await fetch('/api/tools/pattern-tile', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Processing failed' }))
        throw new Error(data.error || 'Processing failed')
      }

      const blob = await res.blob()
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(URL.createObjectURL(blob))
      trackToolUsage('pattern-tile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    const baseName = file.name.replace(/\.[^.]+$/, '')
    a.download = `${baseName}-pattern.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleReset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
    setError(null)
    onReset()
  }

  return (
    <div className="space-y-6">
      {/* Repeat mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Repeat Mode</label>
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scale slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Scale: {scale.toFixed(2)}x
        </label>
        <input
          type="range"
          min={0.25}
          max={2.0}
          step={0.25}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0.25x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Grid size */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Columns</label>
          <input
            type="number"
            min={1}
            max={10}
            value={cols}
            onChange={(e) => setCols(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rows</label>
          <input
            type="number"
            min={1}
            max={10}
            value={rows}
            onChange={(e) => setRows(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={processing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Preview'
        )}
      </button>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {/* Result */}
      {resultUrl && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">Result</h2>
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="Pattern preview" className="max-h-96 rounded" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        {resultUrl && (
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        )}
      </div>
    </div>
  )
}
