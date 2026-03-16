'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Link from 'next/link'
import { useFileDrop } from '@/hooks/use-file-drop'

interface ToolLayoutProps {
  title: string
  description: string
  accept?: string
  multiple?: boolean
  children: (props: {
    files: File[]
    setFiles: (files: File[]) => void
    clearFiles: () => void
  }) => React.ReactNode
  faq?: { question: string; answer: string }[]
}

export default function ToolLayout({
  title,
  description,
  accept = 'image/*',
  multiple = false,
  children,
  faq,
}: ToolLayoutProps) {
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (dropped: File[]) => {
      setFiles(multiple ? dropped : dropped.slice(0, 1))
    },
    [multiple]
  )

  const { isDragging, dropProps } = useFileDrop(onDrop, accept)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles(multiple ? selected : selected.slice(0, 1))
    if (inputRef.current) inputRef.current.value = ''
  }

  const clearFiles = () => setFiles([])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {files.length === 0 ? (
        <div
          {...dropProps}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-1">
            Drop {multiple ? 'images' : 'an image'} here or click to upload
          </p>
          <p className="text-sm text-gray-500">PNG, JPG, WebP, GIF supported</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      ) : (
        children({ files, setFiles, clearFiles })
      )}

      <div className="mt-12 bg-blue-50 rounded-xl p-6 text-center">
        <p className="text-gray-700 mb-3">
          Need product mockups? Create professional mockups for your e-commerce
          listings.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Try Get Mocked Free
        </Link>
      </div>

      {faq && faq.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faq.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <h3 className="font-medium text-gray-900 mb-2">
                  {item.question}
                </h3>
                <p className="text-sm text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
