'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Loader2, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, RotateCcw, ExternalLink, Store,
} from 'lucide-react'
import { api } from '@/lib/api'

interface Render {
  id: string
  renderedImagePath?: string
  mockupTemplate?: { name: string }
}

interface Connection {
  id: string
  shopName: string
  shopId: string
  status: string
}

interface Listing {
  listingId: string
  title: string
  state: string
  thumbnailUrl: string | null
}

interface UploadStatus {
  renderId: string
  status: 'waiting' | 'uploading' | 'complete' | 'failed' | 'already_uploaded'
  error?: string
  etsyImageId?: string
  uploadId?: string
}

type Step = 'shop' | 'listing' | 'confirm' | 'uploading' | 'results'

interface Props {
  renders: Render[]
  onClose: () => void
}

export function SendToShopModal({ renders, onClose }: Props) {
  const [step, setStep] = useState<Step>('shop')
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [listingSearch, setListingSearch] = useState('')
  const [listingPage, setListingPage] = useState(1)
  const [listingTotalPages, setListingTotalPages] = useState(1)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(false)

  useEffect(() => {
    loadConnections()
  }, [])

  async function loadConnections() {
    try {
      const data = await api.getEtsyConnections()
      const conns = data.connections.filter((c: Connection) => c.status === 'connected')
      setConnections(conns)
      if (conns.length === 1) {
        setSelectedConnection(conns[0])
        setStep('listing')
        loadListings(conns[0].id)
      } else if (conns.length === 0) {
        setStep('shop')
      }
    } catch (err) {
      console.error('Failed to load connections:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadListings = useCallback(async (connectionId: string, page = 1, search?: string) => {
    setListingsLoading(true)
    try {
      const data = await api.getEtsyListings(connectionId, page, search)
      setListings(data.listings)
      setListingPage(data.page)
      setListingTotalPages(data.totalPages)
    } catch (err) {
      console.error('Failed to load listings:', err)
    } finally {
      setListingsLoading(false)
    }
  }, [])

  function handleSelectShop(conn: Connection) {
    setSelectedConnection(conn)
    setStep('listing')
    loadListings(conn.id)
  }

  function handleSelectListing(listing: Listing) {
    setSelectedListing(listing)
    setStep('confirm')
  }

  function handleSearchListings(search: string) {
    setListingSearch(search)
    if (selectedConnection) {
      loadListings(selectedConnection.id, 1, search)
    }
  }

  async function handleUpload() {
    if (!selectedConnection || !selectedListing) return

    setStep('uploading')
    const statuses: UploadStatus[] = renders.map((r) => ({
      renderId: r.id,
      status: 'waiting' as const,
    }))
    setUploadStatuses([...statuses])

    for (let i = 0; i < renders.length; i++) {
      statuses[i] = { ...statuses[i], status: 'uploading' }
      setUploadStatuses([...statuses])

      try {
        const result = await api.uploadToEtsy({
          etsyConnectionId: selectedConnection.id,
          etsyListingId: selectedListing.listingId,
          renderedMockupId: renders[i].id,
        })

        statuses[i] = {
          ...statuses[i],
          status: result.status === 'already_uploaded' ? 'already_uploaded' : 'complete',
          etsyImageId: result.etsyImageId,
          uploadId: result.id,
        }
      } catch (err) {
        statuses[i] = {
          ...statuses[i],
          status: 'failed',
          error: err instanceof Error ? err.message : 'Upload failed',
        }
      }
      setUploadStatuses([...statuses])
    }

    setStep('results')
  }

  async function handleRetryFailed() {
    if (!selectedConnection || !selectedListing) return

    setStep('uploading')
    const statuses = [...uploadStatuses]

    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i].status !== 'failed') continue

      statuses[i] = { ...statuses[i], status: 'uploading' }
      setUploadStatuses([...statuses])

      try {
        const result = await api.uploadToEtsy({
          etsyConnectionId: selectedConnection.id,
          etsyListingId: selectedListing.listingId,
          renderedMockupId: renders[i].id,
        })
        statuses[i] = {
          ...statuses[i],
          status: result.status === 'already_uploaded' ? 'already_uploaded' : 'complete',
          etsyImageId: result.etsyImageId,
          uploadId: result.id,
        }
      } catch (err) {
        statuses[i] = {
          ...statuses[i],
          status: 'failed',
          error: err instanceof Error ? err.message : 'Retry failed',
        }
      }
      setUploadStatuses([...statuses])
    }

    setStep('results')
  }

  const successCount = uploadStatuses.filter((s) => s.status === 'complete' || s.status === 'already_uploaded').length
  const failedCount = uploadStatuses.filter((s) => s.status === 'failed').length

  function renderThumbnail(render: Render) {
    return render.renderedImagePath ? (
      <img
        src={api.getDownloadUrl(render.id)}
        alt={render.mockupTemplate?.name || 'Render'}
        className="w-16 h-16 object-cover rounded"
      />
    ) : (
      <div className="w-16 h-16 bg-gray-100 rounded" />
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'uploading') onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Store size={20} />
            <h2 className="text-lg font-semibold">
              {step === 'shop' && 'Select Shop'}
              {step === 'listing' && 'Select Listing'}
              {step === 'confirm' && 'Confirm Upload'}
              {step === 'uploading' && 'Uploading...'}
              {step === 'results' && 'Upload Results'}
            </h2>
          </div>
          {step !== 'uploading' && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
          ) : step === 'shop' && connections.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Store size={40} className="mx-auto mb-3 opacity-50" />
              <p>No shops connected.</p>
              <a
                href="/connections"
                className="text-blue-500 hover:text-blue-600 text-sm mt-2 inline-block"
              >
                Connect your Etsy shop first
              </a>
            </div>
          ) : step === 'shop' ? (
            <div className="space-y-2">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => handleSelectShop(conn)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <span className="text-orange-600 font-bold text-sm">E</span>
                  </div>
                  <div>
                    <p className="font-medium">{conn.shopName}</p>
                    <p className="text-xs text-gray-400">Etsy Shop</p>
                  </div>
                </button>
              ))}
            </div>
          ) : step === 'listing' ? (
            <div>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={listingSearch}
                  onChange={(e) => handleSearchListings(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {listingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : listings.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No active listings found.</p>
              ) : (
                <>
                  <div className="space-y-1">
                    {listings.map((listing) => (
                      <button
                        key={listing.listingId}
                        onClick={() => handleSelectListing(listing)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        {listing.thumbnailUrl ? (
                          <img src={listing.thumbnailUrl} alt="" className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded" />
                        )}
                        <p className="text-sm flex-1 truncate">{listing.title}</p>
                      </button>
                    ))}
                  </div>

                  {listingTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <button
                        onClick={() => selectedConnection && loadListings(selectedConnection.id, listingPage - 1, listingSearch)}
                        disabled={listingPage <= 1}
                        className="p-1 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-gray-400">
                        Page {listingPage} of {listingTotalPages}
                      </span>
                      <button
                        onClick={() => selectedConnection && loadListings(selectedConnection.id, listingPage + 1, listingSearch)}
                        disabled={listingPage >= listingTotalPages}
                        className="p-1 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : step === 'confirm' ? (
            <div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500">Uploading to</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-medium">{selectedConnection?.shopName}</span>
                  <span className="text-gray-300">&rarr;</span>
                  <span className="font-medium truncate">{selectedListing?.title}</span>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-3">
                {renders.length} image{renders.length !== 1 ? 's' : ''} will be appended to this listing
              </p>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {renders.map((r) => (
                  <div key={r.id} className="aspect-square">
                    {renderThumbnail(r)}
                  </div>
                ))}
              </div>
            </div>
          ) : step === 'uploading' || step === 'results' ? (
            <div>
              {step === 'results' && (
                <div className={`rounded-lg p-3 mb-4 text-sm ${
                  failedCount === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {failedCount === 0
                    ? `All ${successCount} image${successCount !== 1 ? 's' : ''} uploaded successfully!`
                    : `${successCount} of ${renders.length} uploaded. ${failedCount} failed.`}
                </div>
              )}

              <div className="space-y-2">
                {renders.map((r, i) => {
                  const status = uploadStatuses[i]
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      {renderThumbnail(r)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{r.mockupTemplate?.name || 'Render'}</p>
                        {status?.status === 'failed' && (
                          <p className="text-xs text-red-500 truncate">{status.error}</p>
                        )}
                        {status?.status === 'already_uploaded' && (
                          <p className="text-xs text-yellow-600">Already uploaded to this listing</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {(!status || status.status === 'waiting') && (
                          <span className="text-xs text-gray-400">Waiting...</span>
                        )}
                        {status?.status === 'uploading' && (
                          <Loader2 size={16} className="animate-spin text-blue-500" />
                        )}
                        {(status?.status === 'complete' || status?.status === 'already_uploaded') && (
                          <CheckCircle size={16} className="text-green-500" />
                        )}
                        {status?.status === 'failed' && (
                          <XCircle size={16} className="text-red-500" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {step !== 'uploading' && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div>
              {(step === 'listing' && connections.length > 1) && (
                <button
                  onClick={() => setStep('shop')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Change shop
                </button>
              )}
              {step === 'confirm' && (
                <button
                  onClick={() => setStep('listing')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Change listing
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {step === 'results' && failedCount > 0 && (
                <button
                  onClick={handleRetryFailed}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw size={14} />
                  Retry Failed
                </button>
              )}
              {step === 'results' && selectedListing && (
                <a
                  href={`https://www.etsy.com/listing/${selectedListing.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink size={14} />
                  View on Etsy
                </a>
              )}
              {step === 'confirm' && (
                <button
                  onClick={handleUpload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upload {renders.length} Image{renders.length !== 1 ? 's' : ''}
                </button>
              )}
              {step === 'results' && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
