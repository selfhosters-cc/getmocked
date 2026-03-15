# Etsy Integration Design

> **Goal:** Let users push rendered mockups directly to their Etsy listings from within Get Mocked.

**Architecture:** Direct API integration — Next.js API routes call Etsy Open API v3. OAuth 2.0 with PKCE for authentication. Multi-shop support with per-user connections.

**Tech Stack:** Etsy Open API v3, OAuth 2.0 PKCE, Prisma (EtsyConnection + EtsyUpload models)

---

## Scope (Phase A — Push Mockups to Listings)

Users can:
- Connect one or more Etsy shops via OAuth
- Select rendered mockups (individually or in bulk) and push them to an existing Etsy listing
- Images are **appended** to the listing (not replacing existing photos)
- Track upload progress per-image with real-time UI feedback
- Retry failed uploads; detect and skip duplicate uploads

Future phases (no rework needed):
- **Phase B:** Pull product data from Etsy (same OAuth, same connection model)
- **Phase C:** Full automation / auto-sync (add polling layer on top)

## Data Model

```
User → has many EtsyConnection (multi-shop)
EtsyConnection → has many EtsyUpload
RenderedMockup → has many EtsyUpload
```

- `EtsyConnection`: shopId, shopName, etsyUserId, accessToken, refreshToken, tokenExpiresAt
- `EtsyUpload`: etsyConnectionId, renderedMockupId, etsyListingId, etsyImageId, status, errorMessage

## OAuth Flow

1. User clicks "Connect Etsy Shop" → `GET /api/etsy/connect`
2. Generates PKCE challenge, stores verifier + state in short-lived httpOnly cookies
3. Redirects to Etsy authorization URL
4. Etsy redirects back → `GET /api/etsy/callback`
5. Validates state, exchanges code for tokens, fetches shop info
6. Upserts EtsyConnection (reconnecting existing shop refreshes tokens)

Scopes: `listings_r listings_w`

## Upload Flow

1. User selects renders → clicks "Send to Shop"
2. Modal: pick shop (skipped if one) → pick listing (searchable, paginated) → confirm
3. Frontend uploads **one image at a time** via `POST /api/etsy/upload`
4. Each request: validates ownership, checks slots (<10), reads file from disk, uploads to Etsy, creates EtsyUpload record
5. UI updates per-image: waiting → uploading → complete/failed
6. On completion: summary with retry-failed and "View on Etsy" link

## Error Handling

- **Listing full (10 photos):** Pre-check slot count, reject with clear message
- **Token expired:** Auto-refresh 5 min before expiry; if refresh fails, mark connection stale
- **Partial failure:** Continue uploading remaining images, report which failed
- **Duplicate detection:** Check for existing successful EtsyUpload with same connection+render+listing
- **Rate limiting:** Forward Etsy's 429 to frontend
- **Missing render file:** Skip with error, continue others

## UI

- **Connections page** (`/connections`): Add/view/disconnect Etsy shops
- **Sidebar**: "Connections" nav item with Plug icon
- **Batch detail page**: "Send to Shop" bulk button + per-render icon, checkbox selection
- **Send to Shop modal**: 5-step flow (shop → listing → confirm → uploading → results)
- Generic "Send to Shop" labeling (not "Send to Etsy") for future Shopify support

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/etsy/connect` | GET | Initiate OAuth |
| `/api/etsy/callback` | GET | OAuth callback |
| `/api/etsy/connections` | GET | List user's shops |
| `/api/etsy/connections/[id]` | DELETE | Disconnect shop |
| `/api/etsy/connections/[id]/listings` | GET | Fetch shop listings |
| `/api/etsy/upload` | POST | Upload single render to listing |
| `/api/etsy/uploads` | GET | Upload history |
