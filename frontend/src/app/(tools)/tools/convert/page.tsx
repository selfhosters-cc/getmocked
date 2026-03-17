'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, RotateCcw, RefreshCw } from 'lucide-react'
import JSZip from 'jszip'
import ToolLayout from '@/components/tool-layout'
import { trackToolUsage } from '@/lib/track-tool-usage'

type TargetFormat = 'image/png' | 'image/jpeg' | 'image/webp'

interface ConvertedFile {
  name: string
  blob: Blob
  size: number
  url: string
}

const FORMAT_OPTIONS: { label: string; value: TargetFormat; ext: string }[] = [
  { label: 'PNG', value: 'image/png', ext: '.png' },
  { label: 'JPEG', value: 'image/jpeg', ext: '.jpg' },
  { label: 'WebP', value: 'image/webp', ext: '.webp' },
]

const faq = [
  {
    question: 'What formats can I convert between?',
    answer:
      'You can convert PNG, JPG, WebP, and GIF images to PNG, JPG, or WebP format.',
  },
  {
    question: 'Will converting reduce quality?',
    answer:
      'PNG is lossless. For JPG and WebP, use the quality slider to balance file size and quality. Higher values preserve more detail.',
  },
  {
    question: 'Can I convert multiple images at once?',
    answer:
      'Yes! Upload multiple images and they will all be converted to your chosen format.',
  },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFormatLabel(type: string): string {
  if (type.includes('png')) return 'PNG'
  if (type.includes('jpeg') || type.includes('jpg')) return 'JPEG'
  if (type.includes('webp')) return 'WebP'
  if (type.includes('gif')) return 'GIF'
  return type.split('/')[1]?.toUpperCase() || 'Unknown'
}

function FileThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  if (!url) return <div className="w-10 h-10 bg-gray-200 rounded mr-3 shrink-0" />
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={url} alt={file.name} className="w-10 h-10 object-cover rounded mr-3 shrink-0" />
}

function ConvertedThumbnail({ url, name }: { url: string; name: string }) {
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={url} alt={name} className="w-10 h-10 object-cover rounded mr-3 shrink-0" />
}

export default function ConvertPage() {
  return (
    <ToolLayout
      title="Image Format Converter"
      description="Convert images between PNG, JPG, and WebP formats. Batch support with quality control."
      multiple={true}
      faq={faq}
    >
      {({ files, clearFiles }) => (
        <Converter files={files} onReset={clearFiles} />
      )}
    </ToolLayout>
  )
}

function Converter({
  files,
  onReset,
}: {
  files: File[]
  onReset: () => void
}) {
  const [targetFormat, setTargetFormat] = useState<TargetFormat>('image/png')
  const [quality, setQuality] = useState(85)
  const [converting, setConverting] = useState(false)
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [downloadingZip, setDownloadingZip] = useState(false)

  const showQuality = targetFormat === 'image/jpeg' || targetFormat === 'image/webp'
  const targetExt = FORMAT_OPTIONS.find((f) => f.value === targetFormat)!.ext

  const convertFile = useCallback(
    (file: File, format: TargetFormat, q: number): Promise<ConvertedFile> => {
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

          const qualityArg = format === 'image/png' ? undefined : q / 100
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error(`Failed to convert ${file.name}`))
                return
              }
              const baseName = file.name.replace(/\.[^.]+$/, '')
              const ext =
                FORMAT_OPTIONS.find((f) => f.value === format)?.ext || '.png'
              const newName = `${baseName}${ext}`
              const blobUrl = URL.createObjectURL(blob)
              resolve({
                name: newName,
                blob,
                size: blob.size,
                url: blobUrl,
              })
            },
            format,
            qualityArg
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

  const handleConvertAll = async () => {
    setConverting(true)
    try {
      // Clean up previous URLs
      for (const cf of convertedFiles) {
        URL.revokeObjectURL(cf.url)
      }

      const results = await Promise.all(
        files.map((file) => convertFile(file, targetFormat, quality))
      )
      setConvertedFiles(results)
    } catch (err) {
      console.error('Conversion error:', err)
    } finally {
      setConverting(false)
    }
  }

  const handleDownloadSingle = (cf: ConvertedFile) => {
    const a = document.createElement('a')
    a.href = cf.url
    a.download = cf.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    trackToolUsage('convert')
  }

  const handleDownloadAll = async () => {
    if (convertedFiles.length === 0) return
    setDownloadingZip(true)
    try {
      const zip = new JSZip()
      for (const cf of convertedFiles) {
        zip.file(cf.name, cf.blob)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = 'converted-images.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      trackToolUsage('convert')
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleReset = () => {
    for (const cf of convertedFiles) {
      URL.revokeObjectURL(cf.url)
    }
    setConvertedFiles([])
    onReset()
  }

  return (
    <div className="space-y-6">
      {/* File list */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-2">
          Uploaded Images ({files.length})
        </h2>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <FileThumbnail file={file} />
              <span className="text-gray-900 truncate flex-1 mr-4">
                {file.name}
              </span>
              <span className="text-gray-500 whitespace-nowrap">
                {getFormatLabel(file.type)} &middot; {formatSize(file.size)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion settings */}
      {convertedFiles.length === 0 && (
        <div className="space-y-4">
          {/* Target format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target format
            </label>
            <select
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as TargetFormat)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quality slider */}
          {showQuality && (
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
            <button
              onClick={handleConvertAll}
              disabled={converting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${converting ? 'animate-spin' : ''}`}
              />
              {converting
                ? 'Converting...'
                : `Convert All to ${FORMAT_OPTIONS.find((f) => f.value === targetFormat)!.label}`}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {convertedFiles.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-700">
            Converted Files
          </h2>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {convertedFiles.map((cf, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <ConvertedThumbnail url={cf.url} name={cf.name} />
                <div className="flex-1 mr-4">
                  <span className="text-gray-900 truncate block">
                    {cf.name}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatSize(cf.size)}
                  </span>
                </div>
                <button
                  onClick={() => handleDownloadSingle(cf)}
                  className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))}
          </div>

          {/* Download all + reset */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            {convertedFiles.length > 1 && (
              <button
                onClick={handleDownloadAll}
                disabled={downloadingZip}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                {downloadingZip ? 'Creating ZIP...' : 'Download All as ZIP'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
