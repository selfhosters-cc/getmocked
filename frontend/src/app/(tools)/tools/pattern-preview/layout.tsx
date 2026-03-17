import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Pattern Repeat Preview | Get Mocked',
  description: 'Preview how your design tiles as a repeating pattern. Straight, half-drop, half-brick, and mirror repeat modes for fabric and wallpaper.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
