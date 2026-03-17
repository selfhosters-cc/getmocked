'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import JSZip from 'jszip'
import ToolLayout from '@/components/tool-layout'
import { trackToolUsage } from '@/lib/track-tool-usage'

interface CompressedFile {
  name: string
  originalSize: number
  blob: Blob
  url: string
}

const faq = [
  { question: 'How does compression work?', answer: 'Images are re-encoded as JPEG at your chosen quality level. Lower quality means smaller files but more visual artifacts.' },
  { question: 'What quality should I use?', answer: 'For e-commerce photos, 75-85 is usually a good balance. Below 60, quality loss becomes noticeable.' },
  { question: 'Are my images uploaded anywhere?', answer: 'No. Compression happens entirely in your browser. Your images stay on your device.' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function percentSaved(original: number, compressed: number): string {
  const pct = ((1 - compressed / original) * 100).toFixed(1)
  return `${pct}%`
}

function ZoomComparison({
  originalUrl,
  compressedUrl,
  originalSize,
  compressedSize,
  originalLabel,
  compressedLabel,
}: {
  originalUrl: string
  compressedUrl: string
  originalSize: number
  compressedSize: number
  originalLabel?: string
  compressedLabel?: string
}) {
  const [zoom, setZoom] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 })
  const zoomLevel = 3

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setZoomPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
  }

  const imageStyle = zoom
    ? {
        transform: `scale(${zoomLevel})`,
        transformOrigin: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
        transition: 'transform-origin 0.1s ease-out',
      }
    : {}

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div
          className="bg-gray-100 rounded-lg p-2 text-center overflow-hidden cursor-zoom-in"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => setZoom(false)}
          onMouseMove={handleMouseMove}
        >
          <p className="text-xs text-gray-500 mb-2">{originalLabel || 'Original'}</p>
          <div className="overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={originalUrl} alt="Original" className="max-h-64 mx-auto" style={imageStyle} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{formatSize(originalSize)}</p>
        </div>
        <div
          className="bg-gray-100 rounded-lg p-2 text-center overflow-hidden cursor-zoom-in"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => setZoom(false)}
          onMouseMove={handleMouseMove}
        >
          <p className="text-xs text-gray-500 mb-2">{compressedLabel || 'Compressed'}</p>
          <div className="overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={compressedUrl} alt="Compressed" className="max-h-64 mx-auto" style={imageStyle} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{formatSize(compressedSize)}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-1">Hover to zoom and compare</p>
    </div>
  )
}

export default function CompressPage() {
  return (
    <ToolLayout
      title="Image Compressor"
      description="Compress images to reduce file size while maintaining quality. Side-by-side preview."
      multiple={true}
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <Compressor files={files} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function Compressor({
  files,
  onReset,
}: {
  files: File[]
  onReset: () => void
}) {
  const [quality, setQuality] = useState(80)
  const [compressedFiles, setCompressedFiles] = useState<CompressedFile[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const prevUrlsRef = useRef<string[]>([])

  const compressFile = useCallback(
    (file: File, q: number): Promise<CompressedFile> => {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(url)
            reject(new Error('Could not get canvas context'))
            return
          }
          ctx.drawImage(img, 0, 0)
          URL.revokeObjectURL(url)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error(`Failed to compress ${file.name}`))
                return
              }
              const baseName = file.name.replace(/\.[^.]+$/, '')
              const blobUrl = URL.createObjectURL(blob)
              resolve({
                name: `${baseName}-compressed.jpg`,
                originalSize: file.size,
                blob,
                url: blobUrl,
              })
            },
            'image/jpeg',
            q / 100
          )
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error(`Failed to load ${file.name}`))
        }
        img.src = url
      })
    },
    []
  )

  // Compress all files whenever quality changes
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const results = await Promise.all(
          files.map((file) => compressFile(file, quality))
        )
        if (cancelled) {
          for (const r of results) URL.revokeObjectURL(r.url)
          return
        }
        // Revoke old URLs
        for (const url of prevUrlsRef.current) {
          URL.revokeObjectURL(url)
        }
        prevUrlsRef.current = results.map((r) => r.url)
        setCompressedFiles(results)
      } catch (err) {
        console.error('Compression error:', err)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [files, quality, compressFile])

  // Generate original preview URL for selected file
  useEffect(() => {
    const file = files[selectedIndex]
    if (!file) return
    const url = URL.createObjectURL(file)
    setOriginalPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [files, selectedIndex])

  const handleDownloadSingle = (cf: CompressedFile) => {
    const a = document.createElement('a')
    a.href = cf.url
    a.download = cf.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    trackToolUsage('compress')
  }

  const handleDownloadAll = async () => {
    if (compressedFiles.length === 0) return
    setDownloadingZip(true)
    try {
      const zip = new JSZip()
      for (const cf of compressedFiles) {
        zip.file(cf.name, cf.blob)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = 'compressed-images.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      trackToolUsage('compress')
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleReset = () => {
    for (const url of prevUrlsRef.current) {
      URL.revokeObjectURL(url)
    }
    prevUrlsRef.current = []
    setCompressedFiles([])
    onReset()
  }

  const selectedCompressed = compressedFiles[selectedIndex]

  return (
    <div className="space-y-6">
      {/* Quality slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Quality: {quality}%
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Smaller file</span>
          <span>Higher quality</span>
        </div>
      </div>

      {/* Side-by-side preview */}
      {originalPreviewUrl && selectedCompressed && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Preview{files.length > 1 ? ` — ${files[selectedIndex].name}` : ''}
          </h2>
          <ZoomComparison
            originalUrl={originalPreviewUrl}
            compressedUrl={selectedCompressed.url}
            originalSize={files[selectedIndex].size}
            compressedSize={selectedCompressed.blob.size}
          />
          <p className="text-sm text-center text-gray-600 mt-2">
            {formatSize(files[selectedIndex].size)} &rarr;{' '}
            {formatSize(selectedCompressed.blob.size)} &middot;{' '}
            {percentSaved(files[selectedIndex].size, selectedCompressed.blob.size)} saved
          </p>
        </div>
      )}

      {/* File list with per-file stats */}
      {files.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Files ({files.length})
          </h2>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {files.map((file, i) => {
              const cf = compressedFiles[i]
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors ${
                    i === selectedIndex
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedIndex(i)}
                >
                  <span className="text-gray-900 truncate flex-1 mr-4">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    {cf ? (
                      <>
                        <span className="text-gray-500 text-xs">
                          {formatSize(file.size)} &rarr; {formatSize(cf.blob.size)}{' '}
                          ({percentSaved(file.size, cf.blob.size)})
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadSingle(cf)
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">Compressing...</span>
                    )}
                  </div>
                </div>
              )
            })}
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
        {compressedFiles.length > 1 && (
          <button
            onClick={handleDownloadAll}
            disabled={downloadingZip}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {downloadingZip ? 'Creating ZIP...' : 'Download All as ZIP'}
          </button>
        )}
        {compressedFiles.length === 1 && (
          <button
            onClick={() => handleDownloadSingle(compressedFiles[0])}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Compressed
          </button>
        )}
      </div>
    </div>
  )
}
