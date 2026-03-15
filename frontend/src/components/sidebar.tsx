'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LayoutDashboard, Layers, Palette, ImageDown, Heart, LogOut, Menu, X, Image, BookOpen, Plug, Settings } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sets', label: 'My Sets', icon: Layers },
  { href: '/templates', label: 'Templates', icon: BookOpen },
  { href: '/library', label: 'My Library', icon: Image },
  { href: '/designs', label: 'My Designs', icon: Palette },
  { href: '/renders', label: 'Renders', icon: ImageDown },
  { href: '/favourites', label: 'Favourites', icon: Heart },
  { href: '/connections', label: 'Connections', icon: Plug },
]

const adminNav = [
  { href: '/admin/settings', label: 'Admin Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sidebarContent = (
    <>
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Get Mocked</h1>
        <button onClick={() => setOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1">
          <X size={20} />
        </button>
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
      {user?.isAdmin && (
        <nav className="px-4 mt-2 pt-2 border-t border-gray-700">
          {adminNav.map(({ href, label, icon: Icon }) => (
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
      )}
      <div className="border-t border-gray-700 p-4">
        <div className="text-sm text-gray-400 mb-2 truncate">{user?.email}</div>
        <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center h-14 px-4">
        <button onClick={() => setOpen(true)} className="p-1 -ml-1">
          <Menu size={24} />
        </button>
        <span className="ml-3 font-bold">Get Mocked</span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      )}

      {/* Mobile slide-out drawer */}
      <aside className={`
        md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 text-white
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col bg-gray-900 text-white shrink-0">
        {sidebarContent}
      </aside>
    </>
  )
}
