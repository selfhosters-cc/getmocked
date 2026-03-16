import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Image Format Converter | Get Mocked',
  description:
    'Convert images between PNG, JPG, and WebP formats. Batch support with quality control. Free, instant, no signup.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
