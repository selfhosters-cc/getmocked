'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { signup } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await signup(email, password, name || undefined)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-center">Create your account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required minLength={6} />
          <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
