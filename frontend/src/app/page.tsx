import { redirect } from 'next/navigation'
import { getAuthUserId } from '@/lib/server/auth'
import Link from 'next/link'
import { Layers, ShoppingBag, Maximize } from 'lucide-react'

export default async function LandingPage() {
  const userId = await getAuthUserId()
  if (userId) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-block mb-4 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
          Beta — Free Access
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          Get Mocked
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Generate professional product mockups for your Etsy print-on-demand shop. Create once, apply everywhere.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started — It&apos;s Free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-xl border bg-white p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 mb-4">
              <Layers size={24} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Batch Rendering</h3>
            <p className="text-sm text-gray-600">
              Apply one design across all your templates at once. Generate dozens of mockups in seconds.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-orange-50 mb-4">
              <ShoppingBag size={24} className="text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Etsy Integration</h3>
            <p className="text-sm text-gray-600">
              Push finished mockups straight to your Etsy listings. No downloading and re-uploading.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-50 mb-4">
              <Maximize size={24} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Perspective-Accurate</h3>
            <p className="text-sm text-gray-600">
              Realistic warping that matches your product photos. Your designs look like they belong.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        Get Mocked Beta &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
