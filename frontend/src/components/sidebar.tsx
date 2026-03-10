'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LayoutDashboard, Layers, Palette, ImageDown, LogOut } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sets', label: 'My Sets', icon: Layers },
  { href: '/designs', label: 'My Designs', icon: Palette },
  { href: '/renders', label: 'Renders', icon: ImageDown },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">Get Mocked</h1>
      </div>
      <nav className="flex-1 px-4">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 mb-1 transition-colors ${
              pathname.startsWith(href) ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-700 p-4">
        <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
        <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}
