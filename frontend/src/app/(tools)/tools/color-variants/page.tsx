'use client'

import { useState } from 'react'
import { Download, RotateCcw, Loader2, Plus, X } from 'lucide-react'
import Link from 'next/link'
import JSZip from 'jszip'
import ToolLayout from '@/components/tool-layout'
import { useAuth } from '@/lib/auth-context'
import { trackToolUsage } from '@/lib/track-tool-usage'

const faq = [
  { question: 'How does color generation work?', answer: 'The tool converts your product photo to grayscale (preserving shadows and detail) then multiplies by each target color, creating realistic color variants.' },
  { question: 'How many colors can I generate?', answer: 'Up to 20 color variants at once. Add colors using the color picker or by entering hex codes.' },
  { question: 'What format are the results?', answer: 'A ZIP file containing PNG images, one per color variant.' },
]

export default function ColorVariantsPage() {
  const { user, loading } = useAuth()

  if (!user && !loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Color Variant Generator</h1>
        <p className="text-gray-600 mb-8">Generate product color variants from a single photo. Create multiple colorways instantly for your e-commerce listings.</p>
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
      title="Color Variant Generator"
      description="Generate product color variants from a single photo. Add colors and download all variants as a ZIP."
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <ColorVariantsTool file={files[0]} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function ColorVariantsTool({ file, onReset }: { file: File; onReset: () => void }) {
  const [colors, setColors] = useState<string[]>([])
  const [pickerColor, setPickerColor] = useState('#ff0000')
  const [hexInput, setHexInput] = useState('#ff0000')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<{ name: string; url: string }[]>([])
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)

  const addColor = () => {
    const hex = hexInput.startsWith('#') ? hexInput : `#${hexInput}`
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
    if (colors.length >= 20) return
    if (!colors.includes(hex.toLowerCase())) {
      setColors([...colors, hex.toLowerCase()])
    }
  }

  const removeColor = (idx: number) => {
    setColors(colors.filter((_, i) => i !== idx))
  }

  const handleGenerate = async () => {
    if (colors.length === 0) return
    setProcessing(true)
    setError(null)

    // Clean up old previews
    for (const p of previewUrls) URL.revokeObjectURL(p.url)
    setPreviewUrls([])
    setZipBlob(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('colors', colors.join(','))

      const res = await fetch('/api/tools/color-variants', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Processing failed' }))
        throw new Error(data.error || 'Processing failed')
      }

      const blob = await res.blob()
      setZipBlob(blob)

      // Extract images from ZIP for preview
      const zip = await JSZip.loadAsync(blob)
      const previews: { name: string; url: string }[] = []
      for (const [name, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue
        const data = await zipEntry.async('blob')
        previews.push({ name, url: URL.createObjectURL(data) })
      }
      setPreviewUrls(previews)
      trackToolUsage('color-variants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!zipBlob) return
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'color-variants.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    for (const p of previewUrls) URL.revokeObjectURL(p.url)
    setPreviewUrls([])
    setZipBlob(null)
    setError(null)
    onReset()
  }

  return (
    <div className="space-y-6">
      {/* Color picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add Colors</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={pickerColor}
            onChange={(e) => {
              setPickerColor(e.target.value)
              setHexInput(e.target.value)
            }}
            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="#ff0000"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-28"
          />
          <button
            onClick={addColor}
            disabled={colors.length >= 20}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Color
          </button>
        </div>
      </div>

      {/* Color list */}
      {colors.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Colors ({colors.length}/20)
          </label>
          <div className="flex flex-wrap gap-2">
            {colors.map((color, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1"
              >
                <div
                  className="w-5 h-5 rounded-full border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-700">{color}</span>
                <button
                  onClick={() => removeColor(i)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={processing || colors.length === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Variants'
        )}
      </button>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {/* Preview grid */}
      {previewUrls.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Preview ({previewUrls.length} variants)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {previewUrls.map((p, i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="max-h-40 mx-auto rounded" />
                <p className="text-xs text-gray-500 mt-1 truncate">{p.name}</p>
              </div>
            ))}
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
        {zipBlob && (
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </button>
        )}
      </div>
    </div>
  )
}
