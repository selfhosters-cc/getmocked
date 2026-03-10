'use client'
import type { CurveAxis } from '@/lib/canvas-utils'

interface ToolbarProps {
  mode: 'advanced' | 'basic'
  displacementIntensity: number
  transparency: number
  curvature: number
  curveAxis: CurveAxis
  onModeChange: (mode: 'advanced' | 'basic') => void
  onDisplacementChange: (val: number) => void
  onTransparencyChange: (val: number) => void
  onCurvatureChange: (val: number) => void
  onCurveAxisChange: (axis: CurveAxis) => void
  onReset: () => void
  onSave: () => void
  saving: boolean
}

const axisOptions: { value: CurveAxis; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'horizontal', label: 'H' },
  { value: 'vertical', label: 'V' },
]

function curvatureLabel(val: number): string {
  if (Math.abs(val) < 0.01) return 'Flat'
  return `${val > 0 ? '+' : ''}${Math.round(val * 100)}%`
}

export function Toolbar({
  mode, displacementIntensity, transparency, curvature, curveAxis,
  onModeChange, onDisplacementChange, onTransparencyChange,
  onCurvatureChange, onCurveAxisChange,
  onReset, onSave, saving,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 rounded-lg border bg-white p-3 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Mode:</label>
        <select value={mode} onChange={(e) => onModeChange(e.target.value as 'advanced' | 'basic')}
          className="rounded border px-2 py-1 text-sm">
          <option value="advanced">Advanced (4-corner warp)</option>
          <option value="basic">Basic (resize & rotate)</option>
        </select>
      </div>

      {mode === 'advanced' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Disp:</label>
            <input type="range" min="0" max="1" step="0.05" value={displacementIntensity}
              onChange={(e) => onDisplacementChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28" />
            <span className="text-sm text-gray-500 w-8">{Math.round(displacementIntensity * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Trans:</label>
            <input type="range" min="0" max="1" step="0.05" value={transparency}
              onChange={(e) => onTransparencyChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28" />
            <span className="text-sm text-gray-500 w-8">{Math.round(transparency * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap">Curve:</label>
            <input type="range" min="-1" max="1" step="0.05" value={curvature}
              onChange={(e) => onCurvatureChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28" />
            <span className="text-sm text-gray-500 w-12">{curvatureLabel(curvature)}</span>
          </div>
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium whitespace-nowrap mr-1">Axis:</label>
            {axisOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onCurveAxisChange(opt.value)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  curveAxis === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="ml-auto flex gap-2">
        <button onClick={onReset} className="rounded-lg border px-3 sm:px-4 py-1.5 text-sm hover:bg-gray-50">Reset</button>
        <button onClick={onSave} disabled={saving}
          className="rounded-lg bg-blue-600 px-3 sm:px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
