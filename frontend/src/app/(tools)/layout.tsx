'use client'

import Link from 'next/link'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
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
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Get Started Free
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
