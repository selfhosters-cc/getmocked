'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex items-center justify-between p-4 max-w-md mx-auto pt-6">
        <Link href="/" className="text-lg font-bold text-gray-900">Get Mocked</Link>
        <div className="flex items-center gap-4">
          <Link href="/tools" className="text-sm text-gray-600 hover:text-gray-900">Free Tools</Link>
          <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900">Sign Up</Link>
        </div>
      </div>
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-center">Sign in to Get Mocked</h1>

        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 mb-4"
        >
          Sign in with Google
        </a>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">or</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required />
          <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don&apos;t have an account? <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </div>
      </div>
    </div>
  )
}
