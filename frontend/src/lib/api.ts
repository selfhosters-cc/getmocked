async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  signup: (data: { email: string; password: string; name?: string }) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  // Mockup Sets
  getSets: () => request('/api/mockup-sets'),
  getSet: (id: string) => request(`/api/mockup-sets/${id}`),
  createSet: (data: { name: string; description?: string }) =>
    request('/api/mockup-sets', { method: 'POST', body: JSON.stringify(data) }),
  updateSet: (id: string, data: { name?: string; description?: string }) =>
    request(`/api/mockup-sets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSet: (id: string) => request(`/api/mockup-sets/${id}`, { method: 'DELETE' }),

  // Templates (use FormData for file upload)
  uploadTemplate: (setId: string, file: File, name?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (name) form.append('name', name)
    return fetch(`/api/mockup-sets/${setId}/templates`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  updateTemplate: (setId: string, templateId: string, data: Record<string, unknown>) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (setId: string, templateId: string) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}`, { method: 'DELETE' }),

  // Designs
  getDesigns: () => request('/api/designs'),
  uploadDesign: (file: File, name?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (name) form.append('name', name)
    return fetch('/api/designs', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  deleteDesign: (id: string) => request(`/api/designs/${id}`, { method: 'DELETE' }),

  // Render
  batchRender: (
    mockupSetId: string,
    designId: string,
    colorVariants?: string[],
    outputMode?: string,
    outputColor?: string,
    description?: string,
  ) =>
    request('/api/render/batch', {
      method: 'POST',
      body: JSON.stringify({ mockupSetId, designId, colorVariants, outputMode, outputColor, description }),
    }),
  getRenderStatus: (mockupSetId: string, designId: string) =>
    request(`/api/render/status?mockupSetId=${mockupSetId}&designId=${designId}`),
  getDownloadUrl: (renderId: string) => `/api/render/${renderId}/download`,
  getZipUrl: (mockupSetId: string, designId: string) =>
    `/api/render/download-zip?mockupSetId=${mockupSetId}&designId=${designId}`,

  // Batches
  getBatches: (page = 1) => request(`/api/render/batches?page=${page}`),
  getBatch: (batchId: string) => request(`/api/render/batches/${batchId}`),
  deleteBatch: (batchId: string) => request(`/api/render/batches/${batchId}`, { method: 'DELETE' }),
  updateBatch: (batchId: string, data: { description?: string }) =>
    request(`/api/render/batches/${batchId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Color Variants
  updateSetColors: (id: string, colorVariants: Array<{ name: string; hex: string }>) =>
    request(`/api/mockup-sets/${id}`, { method: 'PATCH', body: JSON.stringify({ colorVariants }) }),

  // Mask Detection
  detectMask: (setId: string, templateId: string) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}/mask`, { method: 'POST' }),
  refineMask: (setId: string, templateId: string, maskPath: string, strokes: unknown[]) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}/mask`, {
      method: 'PATCH',
      body: JSON.stringify({ maskPath, strokes }),
    }),

  // Favorites
  toggleTemplateFavorite: (setId: string, templateId: string, isFavorite: boolean) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isFavorite }),
    }),
  toggleRenderFavorite: (renderId: string) =>
    request(`/api/render/${renderId}/favorite`, { method: 'PATCH' }),
  getFavorites: (renderPage?: number) =>
    request(`/api/favorites${renderPage ? `?renderPage=${renderPage}` : ''}`),

  // Template Renders
  getTemplateRenders: (setId: string, templateId: string, page = 1) =>
    request(`/api/mockup-sets/${setId}/templates/${templateId}/renders?page=${page}`),

  // Template Image Library
  getTemplateImages: (page = 1) => request(`/api/template-images?page=${page}`),
  uploadTemplateImage: (file: File, name?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (name) form.append('name', name)
    return fetch('/api/template-images', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  getTemplateImage: (id: string) => request(`/api/template-images/${id}`),
  updateTemplateImage: (id: string, data: { name?: string; defaultOverlayConfig?: unknown; defaultMaskPath?: string }) =>
    request(`/api/template-images/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveTemplateImage: (id: string) =>
    request(`/api/template-images/${id}`, { method: 'DELETE' }),

  // Site-wide Templates
  getSiteTemplates: (page = 1, search?: string) =>
    request(`/api/template-images/site?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  uploadSiteTemplate: (file: File, name?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (name) form.append('name', name)
    return fetch('/api/template-images/site', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  updateSiteTemplate: (id: string, data: { name?: string; defaultOverlayConfig?: unknown }) =>
    request(`/api/template-images/site/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveSiteTemplate: (id: string) =>
    request(`/api/template-images/site/${id}`, { method: 'DELETE' }),

  // Add template to set from library
  addTemplateToSet: (setId: string, templateImageId: string, name?: string) =>
    request(`/api/mockup-sets/${setId}/templates`, {
      method: 'POST',
      body: JSON.stringify({ templateImageId, name }),
    }),

  // Dashboard
  getDashboard: () => request('/api/dashboard'),
}
