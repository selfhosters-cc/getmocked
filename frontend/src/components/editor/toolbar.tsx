'use client'

interface ToolbarProps {
  mode: 'advanced' | 'basic'
  displacementIntensity: number
  onModeChange: (mode: 'advanced' | 'basic') => void
  onDisplacementChange: (val: number) => void
  onReset: () => void
  onSave: () => void
  saving: boolean
}

export function Toolbar({ mode, displacementIntensity, onModeChange, onDisplacementChange, onReset, onSave, saving }: ToolbarProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-white p-3 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Mode:</label>
        <select value={mode} onChange={(e) => onModeChange(e.target.value as 'advanced' | 'basic')}
          className="rounded border px-2 py-1 text-sm">
          <option value="advanced">Advanced (4-corner warp)</option>
          <option value="basic">Basic (resize & rotate)</option>
        </select>
      </div>

      {mode === 'advanced' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Displacement:</label>
          <input type="range" min="0" max="1" step="0.05" value={displacementIntensity}
            onChange={(e) => onDisplacementChange(parseFloat(e.target.value))}
            className="w-32" />
          <span className="text-sm text-gray-500 w-8">{Math.round(displacementIntensity * 100)}%</span>
        </div>
      )}

      <div className="ml-auto flex gap-2">
        <button onClick={onReset} className="rounded-lg border px-4 py-1.5 text-sm hover:bg-gray-50">Reset</button>
        <button onClick={onSave} disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
