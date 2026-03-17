'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export function SignupCta() {
  const { user } = useAuth()
  if (user) return null

  return (
    <div className="bg-blue-50 rounded-xl p-8 text-center">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Need Product Mockups?</h2>
      <p className="text-gray-700 mb-4">
        Create professional product mockups for your e-commerce listings in minutes.
      </p>
      <Link
        href="/signup"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
      >
        Get Started Free
      </Link>
    </div>
  )
}
