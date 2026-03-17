'use client'

import { useState } from 'react'
import { Download, RotateCcw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ToolLayout from '@/components/tool-layout'
import { useAuth } from '@/lib/auth-context'
import { trackToolUsage } from '@/lib/track-tool-usage'

const faq = [
  { question: 'How does background removal work?', answer: 'White mode removes light-colored backgrounds using a brightness threshold. Contour mode detects the largest object and removes everything else.' },
  { question: 'Can I adjust the sensitivity?', answer: 'Yes. The threshold slider controls how aggressive the removal is. Higher values remove only very light pixels, lower values remove more.' },
  { question: 'What format is the output?', answer: 'PNG with transparency. The removed background becomes transparent.' },
]

export default function BackgroundRemoverPage() {
  const { user, loading } = useAuth()

  if (!user && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Background Remover</h1>
        <p className="text-gray-600 mb-8">Remove backgrounds from product photos instantly. White background removal and contour detection modes.</p>
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
      title="Background Remover"
      description="Remove backgrounds from product photos. Choose white background or contour detection mode."
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <BackgroundRemoverTool file={files[0]} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function BackgroundRemoverTool({ file, onReset }: { file: File; onReset: () => void }) {
  const [mode, setMode] = useState<'white' | 'contour'>('white')
  const [threshold, setThreshold] = useState(240)
  const [processing, setProcessing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRemove = async () => {
    setProcessing(true)
    setError(null)
    setResultUrl(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('threshold', threshold.toString())
      formData.append('mode', mode)

      const res = await fetch('/api/tools/background-remove', {
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
      trackToolUsage('background-remove')
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
    a.download = `${baseName}-no-bg.png`
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
      {/* Mode toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('white')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'white'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            White Background
          </button>
          <button
            onClick={() => setMode('contour')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'contour'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Contour Detection
          </button>
        </div>
      </div>

      {/* Threshold slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Threshold: {threshold}
        </label>
        <input
          type="range"
          min={200}
          max={255}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>More aggressive</span>
          <span>Less aggressive</span>
        </div>
      </div>

      {/* Process button */}
      <button
        onClick={handleRemove}
        disabled={processing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Remove Background'
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Result */}
      {resultUrl && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">Result</h2>
          <div
            className="rounded-lg p-4 flex items-center justify-center"
            style={{
              backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)',
              backgroundSize: '20px 20px',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="Background removed" className="max-h-96 rounded" />
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
            Download PNG
          </button>
        )}
      </div>
    </div>
  )
}
