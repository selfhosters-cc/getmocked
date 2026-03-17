import { Metadata } from 'next'
import Link from 'next/link'
import { SignupCta } from '@/components/signup-cta'
import {
  Maximize,
  Crop,
  RefreshCw,
  Archive,
  Ruler,
  Eraser,
  Palette,
  Grid3X3,
  Stamp,
  LucideIcon,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Free Image Tools for E-Commerce Sellers | Get Mocked',
  description:
    'Free online image tools for e-commerce sellers and designers. Resize, crop, convert, compress images and more. No signup required.',
}

interface Tool {
  slug: string
  name: string
  description: string
  icon: LucideIcon
  requiresLogin: boolean
}

const publicTools: Tool[] = [
  {
    slug: 'resize',
    name: 'Image Resizer',
    description: 'Resize images to exact dimensions or percentages. Perfect for marketplace listing requirements.',
    icon: Maximize,
    requiresLogin: false,
  },
  {
    slug: 'crop',
    name: 'Image Cropper',
    description: 'Crop images with preset aspect ratios for Etsy, Amazon, Shopify, and more.',
    icon: Crop,
    requiresLogin: false,
  },
  {
    slug: 'convert',
    name: 'Format Converter',
    description: 'Convert between PNG, JPG, and WebP formats instantly.',
    icon: RefreshCw,
    requiresLogin: false,
  },
  {
    slug: 'compress',
    name: 'Image Compressor',
    description: 'Reduce file size while keeping quality high. Meet marketplace upload limits.',
    icon: Archive,
    requiresLogin: false,
  },
  {
    slug: 'dpi',
    name: 'DPI Checker & Converter',
    description: 'Check image DPI and convert between 72, 150, and 300 DPI for print-ready files.',
    icon: Ruler,
    requiresLogin: false,
  },
]

const loginTools: Tool[] = [
  {
    slug: 'background-remover',
    name: 'Background Remover',
    description: 'Remove image backgrounds automatically. Great for product photos.',
    icon: Eraser,
    requiresLogin: true,
  },
  {
    slug: 'color-variants',
    name: 'Color Variants',
    description: 'Generate color variations of your designs for multi-color listings.',
    icon: Palette,
    requiresLogin: true,
  },
  {
    slug: 'pattern-preview',
    name: 'Pattern Preview',
    description: 'Preview seamless pattern tiles to check repeats before printing.',
    icon: Grid3X3,
    requiresLogin: true,
  },
  {
    slug: 'watermark',
    name: 'Watermark Tool',
    description: 'Add text or image watermarks to protect your designs.',
    icon: Stamp,
    requiresLogin: true,
  },
]

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{tool.name}</h3>
            {tool.requiresLogin && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Free account
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{tool.description}</p>
        </div>
      </div>
    </Link>
  )
}

export default function ToolsIndexPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Free Image Tools</h1>
        <p className="text-gray-600 text-lg">
          Quick image tools built for e-commerce sellers and designers. No watermarks, no limits on the basics.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Instant Tools — No Signup Required
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {publicTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Advanced Tools — Free Account Required
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {loginTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      <SignupCta />
    </div>
  )
}
