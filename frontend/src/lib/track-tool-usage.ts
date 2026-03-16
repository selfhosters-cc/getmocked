export async function trackToolUsage(tool: string) {
  try {
    await fetch('/api/tools/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tool }),
    })
  } catch {
    // Silently fail — usage tracking should never block the user
  }
}
