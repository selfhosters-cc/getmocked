'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Maximize, Crop, RefreshCw, Archive, Ruler, Eraser, Palette, Grid3X3, Stamp } from 'lucide-react'

const tools = [
  { slug: 'resize', label: 'Resize', icon: Maximize },
  { slug: 'crop', label: 'Crop', icon: Crop },
  { slug: 'convert', label: 'Convert', icon: RefreshCw },
  { slug: 'compress', label: 'Compress', icon: Archive },
  { slug: 'dpi', label: 'DPI', icon: Ruler },
  { slug: 'background-remover', label: 'BG Remove', icon: Eraser },
  { slug: 'color-variants', label: 'Colors', icon: Palette },
  { slug: 'pattern-preview', label: 'Pattern', icon: Grid3X3 },
  { slug: 'watermark', label: 'Watermark', icon: Stamp },
]

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const isToolPage = pathname !== '/tools' && pathname.startsWith('/tools/')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Get Mocked
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/tools" className="text-sm text-gray-600 hover:text-gray-900">
              Free Tools
            </Link>
            {user ? (
              <Link href="/dashboard" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {isToolPage && (
        <nav className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
              {tools.map(({ slug, label, icon: Icon }) => {
                const active = pathname === `/tools/${slug}`
                return (
                  <Link
                    key={slug}
                    href={`/tools/${slug}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      )}
      <main>{children}</main>
    </div>
  )
}
