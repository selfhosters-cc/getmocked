import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Background Remover | Get Mocked',
  description: 'Remove backgrounds from product photos instantly. White background removal and contour detection modes. Free online tool.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
