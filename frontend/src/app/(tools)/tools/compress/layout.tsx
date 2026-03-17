import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Image Compressor | Get Mocked',
  description: 'Compress images to reduce file size while maintaining quality. Side-by-side preview. Free, instant.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
