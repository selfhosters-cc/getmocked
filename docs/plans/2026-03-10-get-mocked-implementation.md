# Get Mocked Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app for Etsy POD sellers to create reusable mockup templates and batch-apply designs.

**Architecture:** Three Dockerized services — Next.js frontend, Node.js/Express API, Python/FastAPI image processing. Postgres database, local filesystem storage with abstraction layer.

**Tech Stack:** Next.js 14 (App Router), Node.js/Express, Python/FastAPI, Postgres, Prisma ORM, Docker Compose, Pillow/OpenCV/NumPy, Canvas API/WebGL, Passport.js (Google OAuth + local), JWT

---

## Phase 1: Project Scaffolding & Infrastructure

### Task 1: Monorepo Structure & Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `frontend/package.json`
- Create: `backend/package.json`
- Create: `processing/requirements.txt`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create root .gitignore**

```gitignore
node_modules/
.next/
dist/
__pycache__/
*.pyc
.env
uploads/
rendered/
.venv/
```

**Step 2: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://getmocked:getmocked@db:5432/getmocked

# Auth
JWT_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Services
BACKEND_URL=http://localhost:4000
PROCESSING_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Storage
UPLOAD_DIR=/app/uploads
RENDER_DIR=/app/rendered
```

**Step 3: Create docker-compose.yml**

```yaml
version: "3.8"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: getmocked
      POSTGRES_PASSWORD: getmocked
      POSTGRES_DB: getmocked
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://getmocked:getmocked@db:5432/getmocked
      JWT_SECRET: dev-secret-change-me
      PROCESSING_URL: http://processing:5000
      UPLOAD_DIR: /app/uploads
      RENDER_DIR: /app/rendered
    volumes:
      - ./backend:/app
      - /app/node_modules
      - uploads:/app/uploads
      - rendered:/app/rendered
    depends_on:
      - db

  processing:
    build: ./processing
    ports:
      - "5000:5000"
    volumes:
      - ./processing:/app
      - uploads:/app/uploads
      - rendered:/app/rendered

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend

volumes:
  pgdata:
  uploads:
  rendered:
```

**Step 4: Create backend Dockerfile and package.json**

Create `backend/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "dev"]
```

Create `backend/package.json`:
```json
{
  "name": "getmocked-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "npx tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^6.4.0",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-local": "^1.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/passport": "^1.0.17",
    "@types/passport-google-oauth20": "^2.0.16",
    "@types/passport-local": "^1.0.38",
    "prisma": "^6.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Create `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Create processing service**

Create `processing/Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--reload"]
```

Create `processing/requirements.txt`:
```
fastapi==0.115.0
uvicorn==0.34.0
pillow==11.1.0
opencv-python-headless==4.11.0.86
numpy==2.2.0
python-multipart==0.0.20
httpx==0.28.0
pytest==8.3.0
```

Create `processing/app/__init__.py` (empty file).

Create `processing/app/main.py`:
```python
from fastapi import FastAPI

app = FastAPI(title="Get Mocked - Image Processing")


@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 6: Create frontend**

Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

Create `frontend/package.json`:
```json
{
  "name": "getmocked-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.472.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

Create `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Create `frontend/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

Create `frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

Create `frontend/postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Create `frontend/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Get Mocked',
  description: 'Mockup generator for Etsy POD sellers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
```

Create `frontend/src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Get Mocked</h1>
    </main>
  )
}
```

**Step 7: Verify docker-compose builds and starts**

Run: `docker compose build && docker compose up -d`
Expected: All 4 services start. Frontend on :3000, backend on :4000, processing on :5000, db on :5433.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Docker Compose, three services"
```

---

### Task 2: Database Schema & Prisma Setup

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/index.ts`

**Step 1: Create Prisma schema**

Create `backend/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String       @id @default(uuid())
  email        String       @unique
  name         String?
  passwordHash String?      @map("password_hash")
  authProvider String       @default("email") @map("auth_provider")
  createdAt    DateTime     @default(now()) @map("created_at")
  mockupSets   MockupSet[]
  designs      Design[]

  @@map("users")
}

model MockupSet {
  id          String           @id @default(uuid())
  userId      String           @map("user_id")
  name        String
  description String?
  createdAt   DateTime         @default(now()) @map("created_at")
  user        User             @relation(fields: [userId], references: [id])
  templates   MockupTemplate[]

  @@map("mockup_sets")
}

model MockupTemplate {
  id               String          @id @default(uuid())
  mockupSetId      String          @map("mockup_set_id")
  name             String
  originalImagePath String         @map("original_image_path")
  overlayConfig    Json?           @map("overlay_config")
  sortOrder        Int             @default(0) @map("sort_order")
  mockupSet        MockupSet       @relation(fields: [mockupSetId], references: [id], onDelete: Cascade)
  renderedMockups  RenderedMockup[]

  @@map("mockup_templates")
}

model Design {
  id              String          @id @default(uuid())
  userId          String          @map("user_id")
  name            String
  imagePath       String          @map("image_path")
  createdAt       DateTime        @default(now()) @map("created_at")
  user            User            @relation(fields: [userId], references: [id])
  renderedMockups RenderedMockup[]

  @@map("designs")
}

model RenderedMockup {
  id                String         @id @default(uuid())
  mockupTemplateId  String         @map("mockup_template_id")
  designId          String         @map("design_id")
  renderedImagePath String         @map("rendered_image_path")
  status            String         @default("pending")
  createdAt         DateTime       @default(now()) @map("created_at")
  mockupTemplate    MockupTemplate @relation(fields: [mockupTemplateId], references: [id], onDelete: Cascade)
  design            Design         @relation(fields: [designId], references: [id])

  @@map("rendered_mockups")
}
```

**Step 2: Create basic Express server**

Create `backend/src/index.ts`:
```typescript
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
```

**Step 3: Run migration**

Run: `docker compose up -d db && docker compose run --rm backend npx prisma migrate dev --name init`
Expected: Migration created, tables exist in Postgres.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: database schema with Prisma, basic Express server"
```

---

## Phase 2: Backend API

### Task 3: Authentication — Email Signup & Login

**Files:**
- Create: `backend/src/lib/prisma.ts`
- Create: `backend/src/lib/jwt.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/middleware/auth.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/routes/__tests__/auth.test.ts`

**Step 1: Write failing test for signup**

Create `backend/src/routes/__tests__/auth.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// We'll test auth routes via supertest-style HTTP calls
// For now, test the JWT and password utilities directly

import { hashPassword, comparePassword } from '../../lib/auth-utils.js'
import { signToken, verifyToken } from '../../lib/jwt.js'

describe('auth utilities', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('test123')
    expect(hash).not.toBe('test123')
    expect(await comparePassword('test123', hash)).toBe(true)
    expect(await comparePassword('wrong', hash)).toBe(false)
  })

  it('signs and verifies JWT tokens', () => {
    const token = signToken({ userId: 'abc-123' })
    const payload = verifyToken(token)
    expect(payload.userId).toBe('abc-123')
  })

  it('rejects invalid JWT tokens', () => {
    expect(() => verifyToken('garbage')).toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/__tests__/auth.test.ts`
Expected: FAIL — modules don't exist yet.

**Step 3: Implement auth utilities**

Create `backend/src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

Create `backend/src/lib/jwt.ts`:
```typescript
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function signToken(payload: { userId: string }): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, SECRET) as { userId: string }
}
```

Create `backend/src/lib/auth-utils.ts`:
```typescript
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/routes/__tests__/auth.test.ts`
Expected: PASS

**Step 5: Create auth middleware**

Create `backend/src/middleware/auth.ts`:
```typescript
import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'

export interface AuthRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  try {
    const payload = verifyToken(token)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

**Step 6: Create auth routes**

Create `backend/src/routes/auth.ts`:
```typescript
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashPassword, comparePassword } from '../lib/auth-utils.js'
import { signToken } from '../lib/jwt.js'

const router = Router()

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, authProvider: 'email' },
    })

    const token = signToken({ userId: user.id })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = signToken({ userId: user.id })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  try {
    const { verifyToken } = await import('../lib/jwt.js')
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
```

**Step 7: Wire auth routes into Express**

Update `backend/src/index.ts` to add:
```typescript
import authRouter from './routes/auth.js'
// ... after middleware setup
app.use('/api/auth', authRouter)
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: email signup/login auth with JWT, middleware, tests"
```

---

### Task 4: Google OAuth

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Create: `backend/src/lib/passport.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create Passport Google strategy**

Create `backend/src/lib/passport.ts`:
```typescript
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { prisma } from './prisma.js'

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value
          if (!email) return done(new Error('No email from Google'))

          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName,
                authProvider: 'google',
              },
            })
          }
          done(null, user)
        } catch (err) {
          done(err as Error)
        }
      }
    )
  )
}

export default passport
```

**Step 2: Add Google auth routes to auth.ts**

Append to `backend/src/routes/auth.ts`:
```typescript
import passport from '../lib/passport.js'

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), (req: Request, res: Response) => {
  const user = req.user as { id: string }
  const token = signToken({ userId: user.id })
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
  res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000')
})
```

**Step 3: Wire passport into Express**

Update `backend/src/index.ts`:
```typescript
import passport from './lib/passport.js'
// ... after middleware
app.use(passport.initialize())
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: Google OAuth SSO via Passport"
```

---

### Task 5: Mockup Sets CRUD API

**Files:**
- Create: `backend/src/routes/mockup-sets.ts`
- Test: `backend/src/routes/__tests__/mockup-sets.test.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write failing test**

Create `backend/src/routes/__tests__/mockup-sets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const mockupSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

describe('mockup set validation', () => {
  it('accepts valid mockup set data', () => {
    const result = mockupSetSchema.safeParse({ name: 'Black T-Shirt', description: '5 angles' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = mockupSetSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it passes (validation only)**

Run: `cd backend && npx vitest run src/routes/__tests__/mockup-sets.test.ts`
Expected: PASS

**Step 3: Implement CRUD routes**

Create `backend/src/routes/mockup-sets.ts`:
```typescript
import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

// List all sets for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  const sets = await prisma.mockupSet.findMany({
    where: { userId: req.userId! },
    include: { templates: { select: { id: true, name: true, originalImagePath: true, sortOrder: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(sets)
})

// Get single set
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const set = await prisma.mockupSet.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { templates: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!set) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json(set)
})

// Create set
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body)
    const set = await prisma.mockupSet.create({
      data: { ...data, userId: req.userId! },
    })
    res.status(201).json(set)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update set
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSchema.parse(req.body)
    const set = await prisma.mockupSet.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data,
    })
    if (set.count === 0) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    const updated = await prisma.mockupSet.findUnique({ where: { id: req.params.id } })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete set
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const result = await prisma.mockupSet.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  })
  if (result.count === 0) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json({ ok: true })
})

export default router
```

**Step 4: Wire into Express**

Update `backend/src/index.ts`:
```typescript
import mockupSetsRouter from './routes/mockup-sets.js'
app.use('/api/mockup-sets', mockupSetsRouter)
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: mockup sets CRUD API"
```

---

### Task 6: Templates CRUD & File Upload

**Files:**
- Create: `backend/src/routes/templates.ts`
- Create: `backend/src/lib/storage.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create storage abstraction**

Create `backend/src/lib/storage.ts`:
```typescript
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const RENDER_DIR = process.env.RENDER_DIR || './rendered'

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function saveUpload(file: Express.Multer.File, subdir: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, subdir)
  await ensureDir(dir)
  const ext = path.extname(file.originalname)
  const filename = `${randomUUID()}${ext}`
  const filepath = path.join(dir, filename)
  await fs.writeFile(filepath, file.buffer)
  return path.join(subdir, filename)
}

export async function deleteFile(relativePath: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, relativePath))
  } catch { /* ignore if already deleted */ }
}

export function getUploadPath(relativePath: string): string {
  return path.join(UPLOAD_DIR, relativePath)
}

export function getRenderPath(relativePath: string): string {
  return path.join(RENDER_DIR, relativePath)
}
```

**Step 2: Create templates routes**

Create `backend/src/routes/templates.ts`:
```typescript
import { Router, Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { saveUpload, deleteFile } from '../lib/storage.js'

const router = Router()
router.use(requireAuth)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const overlayConfigSchema = z.object({
  corners: z.array(z.object({ x: z.number(), y: z.number() })).length(4),
  displacementIntensity: z.number().min(0).max(1).default(0.5),
  textureData: z.any().optional(),
  mode: z.enum(['advanced', 'basic']).default('advanced'),
  // Basic mode fields
  rotation: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
})

// Upload product photo to create a template
router.post('/:setId/templates', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    // Verify set ownership
    const set = await prisma.mockupSet.findFirst({ where: { id: req.params.setId, userId: req.userId! } })
    if (!set) {
      res.status(404).json({ error: 'Set not found' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Image file required' })
      return
    }

    const imagePath = await saveUpload(req.file, `templates/${set.id}`)
    const count = await prisma.mockupTemplate.count({ where: { mockupSetId: set.id } })

    const template = await prisma.mockupTemplate.create({
      data: {
        mockupSetId: set.id,
        name: req.body.name || req.file.originalname,
        originalImagePath: imagePath,
        sortOrder: count,
      },
    })
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update overlay config for a template
router.patch('/:setId/templates/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const set = await prisma.mockupSet.findFirst({ where: { id: req.params.setId, userId: req.userId! } })
    if (!set) {
      res.status(404).json({ error: 'Set not found' })
      return
    }

    const data: Record<string, unknown> = {}
    if (req.body.name) data.name = req.body.name
    if (req.body.sortOrder !== undefined) data.sortOrder = req.body.sortOrder
    if (req.body.overlayConfig) {
      data.overlayConfig = overlayConfigSchema.parse(req.body.overlayConfig)
    }

    const template = await prisma.mockupTemplate.updateMany({
      where: { id: req.params.templateId, mockupSetId: set.id },
      data,
    })
    if (template.count === 0) {
      res.status(404).json({ error: 'Template not found' })
      return
    }
    const updated = await prisma.mockupTemplate.findUnique({ where: { id: req.params.templateId } })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete template
router.delete('/:setId/templates/:templateId', async (req: AuthRequest, res: Response) => {
  const set = await prisma.mockupSet.findFirst({ where: { id: req.params.setId, userId: req.userId! } })
  if (!set) {
    res.status(404).json({ error: 'Set not found' })
    return
  }

  const template = await prisma.mockupTemplate.findFirst({
    where: { id: req.params.templateId, mockupSetId: set.id },
  })
  if (!template) {
    res.status(404).json({ error: 'Template not found' })
    return
  }

  await deleteFile(template.originalImagePath)
  await prisma.mockupTemplate.delete({ where: { id: template.id } })
  res.json({ ok: true })
})

// Serve uploaded images
router.get('/uploads/*', async (req: AuthRequest, res: Response) => {
  const filePath = req.params[0]
  const { getUploadPath } = await import('../lib/storage.js')
  res.sendFile(getUploadPath(filePath), { root: '/' })
})

export default router
```

**Step 3: Wire into Express**

Update `backend/src/index.ts`:
```typescript
import templatesRouter from './routes/templates.js'
app.use('/api/mockup-sets', templatesRouter)
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: templates CRUD with file upload, storage abstraction"
```

---

### Task 7: Designs CRUD & Batch Render API

**Files:**
- Create: `backend/src/routes/designs.ts`
- Create: `backend/src/routes/render.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create designs routes**

Create `backend/src/routes/designs.ts`:
```typescript
import { Router, Response } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { saveUpload, deleteFile } from '../lib/storage.js'

const router = Router()
router.use(requireAuth)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// List designs
router.get('/', async (req: AuthRequest, res: Response) => {
  const designs = await prisma.design.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json(designs)
})

// Upload design
router.post('/', upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image file required' })
    return
  }
  const imagePath = await saveUpload(req.file, `designs/${req.userId}`)
  const design = await prisma.design.create({
    data: {
      userId: req.userId!,
      name: req.body.name || req.file.originalname,
      imagePath,
    },
  })
  res.status(201).json(design)
})

// Delete design
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const design = await prisma.design.findFirst({ where: { id: req.params.id, userId: req.userId! } })
  if (!design) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  await deleteFile(design.imagePath)
  await prisma.design.delete({ where: { id: design.id } })
  res.json({ ok: true })
})

export default router
```

**Step 2: Create render/batch routes**

Create `backend/src/routes/render.ts`:
```typescript
import { Router, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { getUploadPath, getRenderPath } from '../lib/storage.js'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const PROCESSING_URL = process.env.PROCESSING_URL || 'http://localhost:5000'

const router = Router()
router.use(requireAuth)

// Trigger batch render: apply a design to all templates in a set
router.post('/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { mockupSetId, designId } = req.body

    const set = await prisma.mockupSet.findFirst({
      where: { id: mockupSetId, userId: req.userId! },
      include: { templates: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!set) {
      res.status(404).json({ error: 'Mockup set not found' })
      return
    }

    const design = await prisma.design.findFirst({ where: { id: designId, userId: req.userId! } })
    if (!design) {
      res.status(404).json({ error: 'Design not found' })
      return
    }

    // Create pending render records
    const renders = await Promise.all(
      set.templates.map((template) =>
        prisma.renderedMockup.create({
          data: {
            mockupTemplateId: template.id,
            designId: design.id,
            renderedImagePath: '',
            status: 'pending',
          },
        })
      )
    )

    // Fire off async render jobs to processing service
    for (const [i, template] of set.templates.entries()) {
      const render = renders[i]
      // Don't await — fire and forget
      processRender(template, design, render.id).catch(async (err) => {
        console.error(`Render failed for ${render.id}:`, err)
        await prisma.renderedMockup.update({
          where: { id: render.id },
          data: { status: 'failed' },
        })
      })
    }

    res.status(202).json({ renders: renders.map((r) => ({ id: r.id, status: r.status })) })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

async function processRender(
  template: { id: string; originalImagePath: string; overlayConfig: unknown },
  design: { id: string; imagePath: string },
  renderId: string
) {
  await prisma.renderedMockup.update({ where: { id: renderId }, data: { status: 'processing' } })

  const response = await fetch(`${PROCESSING_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateImagePath: getUploadPath(template.originalImagePath),
      designImagePath: getUploadPath(design.imagePath),
      overlayConfig: template.overlayConfig,
      outputDir: getRenderPath(`${design.id}`),
      renderId,
    }),
  })

  if (!response.ok) throw new Error(`Processing service returned ${response.status}`)

  const result = (await response.json()) as { outputPath: string }
  await prisma.renderedMockup.update({
    where: { id: renderId },
    data: { status: 'complete', renderedImagePath: result.outputPath },
  })
}

// Get render status for a batch
router.get('/status', async (req: AuthRequest, res: Response) => {
  const { mockupSetId, designId } = req.query as { mockupSetId: string; designId: string }

  const renders = await prisma.renderedMockup.findMany({
    where: {
      designId,
      mockupTemplate: { mockupSetId, mockupSet: { userId: req.userId! } },
    },
    include: { mockupTemplate: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(renders)
})

// Download single render
router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  const render = await prisma.renderedMockup.findFirst({
    where: {
      id: req.params.id,
      mockupTemplate: { mockupSet: { userId: req.userId! } },
    },
  })
  if (!render || render.status !== 'complete') {
    res.status(404).json({ error: 'Render not found or not complete' })
    return
  }
  res.sendFile(render.renderedImagePath, { root: '/' })
})

// Download all renders as ZIP
router.get('/download-zip', async (req: AuthRequest, res: Response) => {
  const { mockupSetId, designId } = req.query as { mockupSetId: string; designId: string }

  const renders = await prisma.renderedMockup.findMany({
    where: {
      designId,
      status: 'complete',
      mockupTemplate: { mockupSetId, mockupSet: { userId: req.userId! } },
    },
    include: { mockupTemplate: { select: { name: true } } },
  })

  if (renders.length === 0) {
    res.status(404).json({ error: 'No completed renders found' })
    return
  }

  // Use archiver for ZIP — added as dependency
  const archiver = (await import('archiver')).default
  const archive = archiver('zip', { zlib: { level: 9 } })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="mockups-${mockupSetId}.zip"`)
  archive.pipe(res)

  for (const render of renders) {
    const ext = path.extname(render.renderedImagePath) || '.png'
    archive.file(render.renderedImagePath, { name: `${render.mockupTemplate.name}${ext}` })
  }
  await archive.finalize()
})

export default router
```

**Step 3: Add archiver dependency**

Run: `cd backend && npm install archiver && npm install -D @types/archiver`

**Step 4: Wire into Express**

Update `backend/src/index.ts`:
```typescript
import designsRouter from './routes/designs.js'
import renderRouter from './routes/render.js'
app.use('/api/designs', designsRouter)
app.use('/api/render', renderRouter)
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: designs CRUD, batch render API with ZIP download"
```

---

## Phase 3: Image Processing Service

### Task 8: Perspective Transform Endpoint

**Files:**
- Create: `processing/app/transform.py`
- Create: `processing/app/render_endpoint.py`
- Modify: `processing/app/main.py`
- Test: `processing/tests/test_transform.py`

**Step 1: Write failing test**

Create `processing/tests/__init__.py` (empty).

Create `processing/tests/test_transform.py`:
```python
import numpy as np
from PIL import Image
from app.transform import apply_perspective_transform


def test_perspective_transform_produces_output():
    # Create a simple test image and design
    template_img = Image.new("RGB", (800, 600), color=(200, 200, 200))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))

    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(template_img, design_img, corners)
    assert result.size == template_img.size
    # The center of the image should no longer be plain gray
    center_pixel = result.getpixel((400, 300))
    assert center_pixel != (200, 200, 200)


def test_perspective_transform_with_displacement():
    template_img = Image.new("RGB", (800, 600), color=(200, 200, 200))
    design_img = Image.new("RGB", (400, 400), color=(255, 0, 0))
    corners = [
        {"x": 200, "y": 100},
        {"x": 600, "y": 120},
        {"x": 580, "y": 480},
        {"x": 220, "y": 460},
    ]

    result = apply_perspective_transform(
        template_img, design_img, corners, displacement_intensity=0.5
    )
    assert result.size == template_img.size
```

**Step 2: Run test to verify it fails**

Run: `cd processing && python -m pytest tests/test_transform.py -v`
Expected: FAIL — module doesn't exist.

**Step 3: Implement perspective transform**

Create `processing/app/transform.py`:
```python
import cv2
import numpy as np
from PIL import Image


def apply_perspective_transform(
    template: Image.Image,
    design: Image.Image,
    corners: list[dict],
    displacement_intensity: float = 0.0,
    texture_data: dict | None = None,
) -> Image.Image:
    """Apply a design onto a template image using perspective warp."""
    template_cv = np.array(template.convert("RGB"))
    design_cv = np.array(design.convert("RGBA"))

    h, w = design_cv.shape[:2]

    # Source corners (design image corners)
    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])

    # Destination corners (where to place on template)
    dst_pts = np.float32([[c["x"], c["y"]] for c in corners])

    # Compute perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Warp the design
    template_h, template_w = template_cv.shape[:2]
    warped = cv2.warpPerspective(
        design_cv, matrix, (template_w, template_h),
        flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_TRANSPARENT
    )

    # Apply displacement if requested
    if displacement_intensity > 0:
        warped = _apply_displacement(template_cv, warped, displacement_intensity)

    # Composite warped design onto template
    result = _composite(template_cv, warped)

    return Image.fromarray(result)


def _apply_displacement(
    template: np.ndarray, warped: np.ndarray, intensity: float
) -> np.ndarray:
    """Apply texture displacement based on template surface analysis."""
    gray = cv2.cvtColor(template, cv2.COLOR_RGB2GRAY)

    # Detect edges/texture in the template
    edges = cv2.Canny(gray, 50, 150)
    blur = cv2.GaussianBlur(edges.astype(np.float32), (15, 15), 0)
    blur = blur / (blur.max() + 1e-6)  # normalize

    # Use the texture map to modulate the design brightness
    if warped.shape[2] == 4:
        mask = warped[:, :, 3] > 0
        for c in range(3):
            channel = warped[:, :, c].astype(np.float32)
            displacement = 1.0 - (blur * intensity * 0.3)
            channel[mask] = (channel[mask] * displacement[mask]).clip(0, 255)
            warped[:, :, c] = channel.astype(np.uint8)

    return warped


def _composite(background: np.ndarray, overlay: np.ndarray) -> np.ndarray:
    """Composite RGBA overlay onto RGB background."""
    if overlay.shape[2] == 4:
        alpha = overlay[:, :, 3:4].astype(np.float32) / 255.0
        fg = overlay[:, :, :3].astype(np.float32)
        bg = background.astype(np.float32)
        result = (fg * alpha + bg * (1 - alpha)).astype(np.uint8)
        return result
    return overlay[:, :, :3]
```

**Step 4: Run test to verify it passes**

Run: `cd processing && python -m pytest tests/test_transform.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: perspective transform with displacement mapping"
```

---

### Task 9: Render Endpoint & Texture Detection

**Files:**
- Modify: `processing/app/main.py`
- Create: `processing/app/texture.py`
- Test: `processing/tests/test_texture.py`

**Step 1: Write failing test for texture detection**

Create `processing/tests/test_texture.py`:
```python
import numpy as np
from PIL import Image
from app.texture import detect_texture


def test_detect_texture_returns_data():
    # Create a test image with some texture (stripes)
    img = Image.new("RGB", (400, 400), color=(200, 200, 200))
    pixels = np.array(img)
    # Add horizontal stripes for texture
    for i in range(0, 400, 10):
        pixels[i : i + 2, :] = [180, 180, 180]
    img = Image.fromarray(pixels)

    result = detect_texture(img, corners=[
        {"x": 50, "y": 50},
        {"x": 350, "y": 50},
        {"x": 350, "y": 350},
        {"x": 50, "y": 350},
    ])

    assert "edgeDensity" in result
    assert "dominantDirection" in result
    assert isinstance(result["edgeDensity"], float)
```

**Step 2: Run test to verify it fails**

Run: `cd processing && python -m pytest tests/test_texture.py -v`
Expected: FAIL

**Step 3: Implement texture detection**

Create `processing/app/texture.py`:
```python
import cv2
import numpy as np
from PIL import Image


def detect_texture(image: Image.Image, corners: list[dict]) -> dict:
    """Analyze texture within the defined overlay region."""
    img_cv = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)

    # Create mask from corners
    pts = np.array([[c["x"], c["y"]] for c in corners], dtype=np.int32)
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillConvexPoly(mask, pts, 255)

    # Extract region
    region = cv2.bitwise_and(gray, gray, mask=mask)

    # Edge detection
    edges = cv2.Canny(region, 50, 150)
    edge_pixels = np.count_nonzero(edges)
    total_pixels = np.count_nonzero(mask)
    edge_density = float(edge_pixels / max(total_pixels, 1))

    # Dominant direction via Sobel
    sobel_x = cv2.Sobel(region, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(region, cv2.CV_64F, 0, 1, ksize=3)

    angle = np.arctan2(
        np.mean(np.abs(sobel_y[mask > 0])),
        np.mean(np.abs(sobel_x[mask > 0]))
    )
    angle_deg = float(np.degrees(angle))

    if angle_deg < 30:
        direction = "horizontal"
    elif angle_deg > 60:
        direction = "vertical"
    else:
        direction = "diagonal"

    return {
        "edgeDensity": round(edge_density, 4),
        "dominantDirection": direction,
        "angleDeg": round(angle_deg, 2),
    }
```

**Step 4: Run test to verify it passes**

Run: `cd processing && python -m pytest tests/test_texture.py -v`
Expected: PASS

**Step 5: Add render and texture endpoints to main.py**

Update `processing/app/main.py`:
```python
import os
from uuid import uuid4
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image

from app.transform import apply_perspective_transform
from app.texture import detect_texture

app = FastAPI(title="Get Mocked - Image Processing")


class Corner(BaseModel):
    x: float
    y: float


class RenderRequest(BaseModel):
    templateImagePath: str
    designImagePath: str
    overlayConfig: dict
    outputDir: str
    renderId: str


class TextureDetectRequest(BaseModel):
    imagePath: str
    corners: list[Corner]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/render")
def render(req: RenderRequest):
    template = Image.open(req.templateImagePath)
    design = Image.open(req.designImagePath)

    corners = req.overlayConfig.get("corners", [])
    displacement = req.overlayConfig.get("displacementIntensity", 0.0)
    texture_data = req.overlayConfig.get("textureData")

    result = apply_perspective_transform(
        template, design, corners,
        displacement_intensity=displacement,
        texture_data=texture_data,
    )

    os.makedirs(req.outputDir, exist_ok=True)
    output_path = os.path.join(req.outputDir, f"{req.renderId}.png")
    result.save(output_path, "PNG")

    return {"outputPath": output_path}


@app.post("/detect-texture")
def detect_texture_endpoint(req: TextureDetectRequest):
    image = Image.open(req.imagePath)
    corners = [{"x": c.x, "y": c.y} for c in req.corners]
    result = detect_texture(image, corners)
    return result
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: render endpoint, auto texture detection"
```

---

## Phase 4: Frontend

### Task 10: Auth Pages & Layout

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/auth-context.tsx`
- Create: `frontend/src/components/sidebar.tsx`
- Create: `frontend/src/app/(auth)/login/page.tsx`
- Create: `frontend/src/app/(auth)/signup/page.tsx`
- Create: `frontend/src/app/(app)/layout.tsx`
- Create: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Create API client**

Create `frontend/src/lib/api.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
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
    return fetch(`${API_URL}/api/mockup-sets/${setId}/templates`, {
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
    return fetch(`${API_URL}/api/designs`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then((r) => r.json())
  },
  deleteDesign: (id: string) => request(`/api/designs/${id}`, { method: 'DELETE' }),

  // Render
  batchRender: (mockupSetId: string, designId: string) =>
    request('/api/render/batch', { method: 'POST', body: JSON.stringify({ mockupSetId, designId }) }),
  getRenderStatus: (mockupSetId: string, designId: string) =>
    request(`/api/render/status?mockupSetId=${mockupSetId}&designId=${designId}`),
  getDownloadUrl: (renderId: string) => `${API_URL}/api/render/${renderId}/download`,
  getZipUrl: (mockupSetId: string, designId: string) =>
    `${API_URL}/api/render/download-zip?mockupSetId=${mockupSetId}&designId=${designId}`,
}
```

**Step 2: Create auth context**

Create `frontend/src/lib/auth-context.tsx`:
```tsx
'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'

interface User {
  id: string
  email: string
  name: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me().then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password })
    setUser(data.user)
  }

  const signup = async (email: string, password: string, name?: string) => {
    const data = await api.signup({ email, password, name })
    setUser(data.user)
  }

  const logout = async () => {
    await api.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

**Step 3: Create sidebar component**

Create `frontend/src/components/sidebar.tsx`:
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LayoutDashboard, Layers, Palette, ImageDown, LogOut } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sets', label: 'My Sets', icon: Layers },
  { href: '/designs', label: 'My Designs', icon: Palette },
  { href: '/renders', label: 'Renders', icon: ImageDown },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">Get Mocked</h1>
      </div>
      <nav className="flex-1 px-4">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 mb-1 transition-colors ${
              pathname.startsWith(href) ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-700 p-4">
        <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
        <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}
```

**Step 4: Create login page**

Create `frontend/src/app/(auth)/login/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-center">Sign in to Get Mocked</h1>

        <a
          href={`${API_URL}/api/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 mb-4"
        >
          Sign in with Google
        </a>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">or</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required />
          <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don&apos;t have an account? <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
```

**Step 5: Create signup page**

Create `frontend/src/app/(auth)/signup/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { signup } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await signup(email, password, name || undefined)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-center">Create your account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <input type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" required minLength={6} />
          <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

**Step 6: Create app layout with sidebar**

Create `frontend/src/app/(app)/layout.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  if (!user) return null

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
```

**Step 7: Create dashboard page**

Create `frontend/src/app/(app)/dashboard/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Plus, Layers } from 'lucide-react'

export default function DashboardPage() {
  const [sets, setSets] = useState<Array<{ id: string; name: string; description?: string; templates: unknown[] }>>([])

  useEffect(() => {
    api.getSets().then(setSets).catch(console.error)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/sets/new" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Plus size={20} /> New Mockup Set
        </Link>
      </div>

      {sets.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Layers size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No mockup sets yet</p>
          <p className="text-sm">Create your first set to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map((set) => (
            <Link key={set.id} href={`/sets/${set.id}`}
              className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg">{set.name}</h3>
              {set.description && <p className="text-gray-500 text-sm mt-1">{set.description}</p>}
              <p className="text-gray-400 text-sm mt-2">{set.templates.length} template(s)</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 8: Update root layout with AuthProvider and redirect root to dashboard**

Update `frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'Get Mocked',
  description: 'Mockup generator for Etsy POD sellers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

Update `frontend/src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: frontend auth pages, sidebar, dashboard, API client"
```

---

### Task 11: Mockup Set Editor Page

**Files:**
- Create: `frontend/src/app/(app)/sets/new/page.tsx`
- Create: `frontend/src/app/(app)/sets/[id]/page.tsx`
- Create: `frontend/src/app/(app)/sets/page.tsx`

**Step 1: Create sets list page**

Create `frontend/src/app/(app)/sets/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Plus, Trash2 } from 'lucide-react'

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: { id: string }[]
}

export default function SetsPage() {
  const [sets, setSets] = useState<MockupSet[]>([])

  useEffect(() => {
    api.getSets().then(setSets)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mockup set?')) return
    await api.deleteSet(id)
    setSets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Mockup Sets</h1>
        <Link href="/sets/new" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Plus size={20} /> New Set
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map((set) => (
          <div key={set.id} className="rounded-xl border bg-white p-6 flex justify-between items-start">
            <Link href={`/sets/${set.id}`} className="flex-1">
              <h3 className="font-semibold">{set.name}</h3>
              {set.description && <p className="text-gray-500 text-sm mt-1">{set.description}</p>}
              <p className="text-gray-400 text-sm mt-2">{set.templates.length} template(s)</p>
            </Link>
            <button onClick={() => handleDelete(set.id)} className="text-gray-400 hover:text-red-600 ml-2">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create new set page**

Create `frontend/src/app/(app)/sets/new/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function NewSetPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const set = await api.createSet({ name, description: description || undefined })
    router.push(`/sets/${set.id}`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Create Mockup Set</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Black T-Shirt - 5 Angles" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none" rows={3}
            placeholder="Notes about this mockup set..." />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700">
          Create Set
        </button>
      </form>
    </div>
  )
}
```

**Step 3: Create set detail page (manage templates)**

Create `frontend/src/app/(app)/sets/[id]/page.tsx`:
```tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Upload, Trash2, Settings, Play } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Template {
  id: string
  name: string
  originalImagePath: string
  overlayConfig: unknown
  sortOrder: number
}

interface MockupSet {
  id: string
  name: string
  description?: string
  templates: Template[]
}

export default function SetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [set, setSet] = useState<MockupSet | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getSet(id).then(setSet)
  }, [id])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      await api.uploadTemplate(id, file)
    }
    api.getSet(id).then(setSet)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return
    await api.deleteTemplate(id, templateId)
    api.getSet(id).then(setSet)
  }

  if (!set) return <div>Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{set.name}</h1>
          {set.description && <p className="text-gray-500">{set.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/sets/${id}/apply`}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700">
            <Play size={18} /> Apply Design
          </Link>
          <button onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
            <Upload size={18} /> Add Photos
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {set.templates.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <p className="text-lg">No templates yet</p>
          <p className="text-sm">Upload product photos to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {set.templates.map((t) => (
            <div key={t.id} className="group relative rounded-xl border bg-white overflow-hidden">
              <img src={`${API_URL}/api/mockup-sets/uploads/${t.originalImagePath}`}
                alt={t.name} className="w-full aspect-square object-cover" />
              <div className="p-3">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-gray-400">{t.overlayConfig ? 'Configured' : 'Not configured'}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Link href={`/sets/${id}/templates/${t.id}/edit`}
                  className="rounded-full bg-white p-2 shadow hover:bg-gray-100">
                  <Settings size={14} />
                </Link>
                <button onClick={() => handleDeleteTemplate(t.id)}
                  className="rounded-full bg-white p-2 shadow hover:bg-red-50">
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: mockup set pages - list, create, detail with template management"
```

---

### Task 12: Template Editor — Interactive Canvas

**Files:**
- Create: `frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx`
- Create: `frontend/src/components/editor/mockup-canvas.tsx`
- Create: `frontend/src/components/editor/toolbar.tsx`
- Create: `frontend/src/lib/canvas-utils.ts`

**Step 1: Create canvas utility functions**

Create `frontend/src/lib/canvas-utils.ts`:
```typescript
export interface Point {
  x: number
  y: number
}

export interface OverlayConfig {
  corners: Point[]
  displacementIntensity: number
  textureData?: Record<string, unknown>
  mode: 'advanced' | 'basic'
  rotation?: number
  width?: number
  height?: number
  x?: number
  y?: number
}

export function getDefaultCorners(imgWidth: number, imgHeight: number): Point[] {
  const margin = 0.2
  return [
    { x: imgWidth * margin, y: imgHeight * margin },
    { x: imgWidth * (1 - margin), y: imgHeight * margin },
    { x: imgWidth * (1 - margin), y: imgHeight * (1 - margin) },
    { x: imgWidth * margin, y: imgHeight * (1 - margin) },
  ]
}

export function findClosestCorner(corners: Point[], pos: Point, threshold: number): number {
  let closest = -1
  let minDist = threshold
  for (let i = 0; i < corners.length; i++) {
    const dx = corners[i].x - pos.x
    const dy = corners[i].y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) {
      minDist = dist
      closest = i
    }
  }
  return closest
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  corners: Point[],
  previewImage: HTMLImageElement | null,
  scale: number,
) {
  ctx.save()

  // Draw the quadrilateral outline
  ctx.beginPath()
  ctx.moveTo(corners[0].x * scale, corners[0].y * scale)
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x * scale, corners[i].y * scale)
  }
  ctx.closePath()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.stroke()

  // Fill with semi-transparent blue
  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
  ctx.fill()

  // Draw corner handles
  for (const corner of corners) {
    ctx.beginPath()
    ctx.arc(corner.x * scale, corner.y * scale, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

// Simple client-side perspective preview using Canvas 2D
export function drawPerspectivePreview(
  ctx: CanvasRenderingContext2D,
  templateImage: HTMLImageElement,
  designImage: HTMLImageElement,
  corners: Point[],
  scale: number,
) {
  // Draw template
  ctx.drawImage(templateImage, 0, 0, templateImage.width * scale, templateImage.height * scale)

  // For preview, use a simple affine approximation by splitting quad into two triangles
  ctx.save()
  ctx.globalAlpha = 0.85

  // Use canvas clip path for the quad region
  ctx.beginPath()
  ctx.moveTo(corners[0].x * scale, corners[0].y * scale)
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(corners[i].x * scale, corners[i].y * scale)
  }
  ctx.closePath()
  ctx.clip()

  // Compute bounding box and draw design stretched into it (approximate)
  const xs = corners.map((c) => c.x * scale)
  const ys = corners.map((c) => c.y * scale)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  ctx.drawImage(designImage, minX, minY, maxX - minX, maxY - minY)

  ctx.restore()
}
```

**Step 2: Create toolbar component**

Create `frontend/src/components/editor/toolbar.tsx`:
```tsx
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
```

**Step 3: Create the main canvas editor component**

Create `frontend/src/components/editor/mockup-canvas.tsx`:
```tsx
'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { Point, OverlayConfig, getDefaultCorners, findClosestCorner, drawOverlay, drawPerspectivePreview } from '@/lib/canvas-utils'

interface MockupCanvasProps {
  imageUrl: string
  overlayConfig: OverlayConfig | null
  previewDesignUrl?: string
  onConfigChange: (config: OverlayConfig) => void
  mode: 'advanced' | 'basic'
}

export function MockupCanvas({ imageUrl, overlayConfig, previewDesignUrl, onConfigChange, mode }: MockupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [designImage, setDesignImage] = useState<HTMLImageElement | null>(null)
  const [corners, setCorners] = useState<Point[]>([])
  const [dragging, setDragging] = useState(-1)
  const [scale, setScale] = useState(1)
  const [showPreview, setShowPreview] = useState(false)

  // Load template image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      if (!overlayConfig) {
        const defaultCorners = getDefaultCorners(img.width, img.height)
        setCorners(defaultCorners)
        onConfigChange({ corners: defaultCorners, displacementIntensity: 0.5, mode })
      } else {
        setCorners(overlayConfig.corners)
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  // Load preview design
  useEffect(() => {
    if (!previewDesignUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setDesignImage(img)
    img.src = previewDesignUrl
  }, [previewDesignUrl])

  // Calculate scale to fit canvas in container
  useEffect(() => {
    if (!image || !containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const s = Math.min(1, containerWidth / image.width)
    setScale(s)
  }, [image])

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !image) return

    canvas.width = image.width * scale
    canvas.height = image.height * scale

    if (showPreview && designImage) {
      drawPerspectivePreview(ctx, image, designImage, corners, scale)
    } else {
      ctx.drawImage(image, 0, 0, image.width * scale, image.height * scale)
      drawOverlay(ctx, corners, null, scale)
    }
  }, [image, designImage, corners, scale, showPreview])

  useEffect(() => { render() }, [render])

  const getMousePos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e)
    const idx = findClosestCorner(corners, pos, 20 / scale)
    if (idx >= 0) setDragging(idx)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging < 0) return
    const pos = getMousePos(e)
    const newCorners = [...corners]
    newCorners[dragging] = pos
    setCorners(newCorners)
  }

  const handleMouseUp = () => {
    if (dragging >= 0) {
      onConfigChange({ corners, displacementIntensity: overlayConfig?.displacementIntensity ?? 0.5, mode })
    }
    setDragging(-1)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-2 flex gap-2">
        <button onClick={() => setShowPreview(false)}
          className={`px-3 py-1 text-sm rounded ${!showPreview ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
          Edit
        </button>
        <button onClick={() => setShowPreview(true)} disabled={!designImage}
          className={`px-3 py-1 text-sm rounded ${showPreview ? 'bg-blue-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}>
          Preview
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-crosshair rounded-lg border shadow-sm"
      />
    </div>
  )
}
```

**Step 4: Create template editor page**

Create `frontend/src/app/(app)/sets/[id]/templates/[templateId]/edit/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MockupCanvas } from '@/components/editor/mockup-canvas'
import { Toolbar } from '@/components/editor/toolbar'
import { OverlayConfig, getDefaultCorners } from '@/lib/canvas-utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function TemplateEditorPage() {
  const { id: setId, templateId } = useParams<{ id: string; templateId: string }>()
  const router = useRouter()
  const [template, setTemplate] = useState<{
    id: string; name: string; originalImagePath: string; overlayConfig: OverlayConfig | null
  } | null>(null)
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [mode, setMode] = useState<'advanced' | 'basic'>('advanced')
  const [displacement, setDisplacement] = useState(0.5)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getSet(setId).then((set) => {
      const t = set.templates.find((t: { id: string }) => t.id === templateId)
      if (t) {
        setTemplate(t)
        if (t.overlayConfig) {
          setConfig(t.overlayConfig)
          setMode(t.overlayConfig.mode || 'advanced')
          setDisplacement(t.overlayConfig.displacementIntensity ?? 0.5)
        }
      }
    })
  }, [setId, templateId])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await api.updateTemplate(setId, templateId, {
        overlayConfig: { ...config, displacementIntensity: displacement, mode },
      })
      router.push(`/sets/${setId}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    // Will be recalculated from image dimensions by the canvas component
    setConfig(null)
  }

  if (!template) return <div>Loading...</div>

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Edit Template: {template.name}</h1>

      <Toolbar
        mode={mode}
        displacementIntensity={displacement}
        onModeChange={setMode}
        onDisplacementChange={setDisplacement}
        onReset={handleReset}
        onSave={handleSave}
        saving={saving}
      />

      <MockupCanvas
        imageUrl={`${API_URL}/api/mockup-sets/uploads/${template.originalImagePath}`}
        overlayConfig={config}
        onConfigChange={setConfig}
        mode={mode}
      />
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: interactive template editor with 4-corner perspective warp"
```

---

### Task 13: Apply Design Page

**Files:**
- Create: `frontend/src/app/(app)/sets/[id]/apply/page.tsx`

**Step 1: Create apply design page**

Create `frontend/src/app/(app)/sets/[id]/apply/page.tsx`:
```tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Upload, Download, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Design {
  id: string
  name: string
  imagePath: string
}

interface RenderStatus {
  id: string
  status: string
  mockupTemplate: { name: string }
  renderedImagePath: string
}

export default function ApplyDesignPage() {
  const { id: setId } = useParams<{ id: string }>()
  const [designs, setDesigns] = useState<Design[]>([])
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null)
  const [renders, setRenders] = useState<RenderStatus[]>([])
  const [rendering, setRendering] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    api.getDesigns().then(setDesigns)
  }, [])

  const handleUploadDesign = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const design = await api.uploadDesign(file)
    setDesigns((prev) => [design, ...prev])
    setSelectedDesign(design.id)
  }

  const handleRender = async () => {
    if (!selectedDesign) return
    setRendering(true)
    const result = await api.batchRender(setId, selectedDesign)
    setRenders(result.renders)

    // Poll for status
    pollRef.current = setInterval(async () => {
      const status = await api.getRenderStatus(setId, selectedDesign)
      setRenders(status)
      const allDone = status.every((r: RenderStatus) => r.status === 'complete' || r.status === 'failed')
      if (allDone) {
        clearInterval(pollRef.current)
        setRendering(false)
      }
    }, 2000)
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Apply Design</h1>

      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold">Select a Design</h2>
          <button onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <Upload size={14} /> Upload new
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleUploadDesign} />
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {designs.map((d) => (
            <button key={d.id} onClick={() => setSelectedDesign(d.id)}
              className={`rounded-lg border-2 overflow-hidden ${selectedDesign === d.id ? 'border-blue-600' : 'border-transparent'}`}>
              <img src={`${API_URL}/api/mockup-sets/uploads/${d.imagePath}`} alt={d.name}
                className="w-full aspect-square object-cover" />
              <p className="text-xs p-1 truncate">{d.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={handleRender} disabled={!selectedDesign || rendering}
          className="rounded-lg bg-green-600 px-6 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
          {rendering && <Loader2 size={18} className="animate-spin" />}
          {rendering ? 'Rendering...' : 'Render All'}
        </button>
        {renders.some((r) => r.status === 'complete') && selectedDesign && (
          <a href={api.getZipUrl(setId, selectedDesign)}
            className="rounded-lg border px-6 py-2 font-medium hover:bg-gray-50 flex items-center gap-2">
            <Download size={18} /> Download ZIP
          </a>
        )}
      </div>

      {renders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {renders.map((r) => (
            <div key={r.id} className="rounded-xl border bg-white overflow-hidden">
              {r.status === 'complete' ? (
                <img src={api.getDownloadUrl(r.id)} alt={r.mockupTemplate.name}
                  className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
                  {r.status === 'failed' ? (
                    <span className="text-red-500 text-sm">Failed</span>
                  ) : (
                    <Loader2 className="animate-spin text-gray-400" />
                  )}
                </div>
              )}
              <div className="p-2">
                <p className="text-sm truncate">{r.mockupTemplate.name}</p>
                <p className="text-xs text-gray-400 capitalize">{r.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: apply design page with batch render and ZIP download"
```

---

### Task 14: Designs & Renders Pages

**Files:**
- Create: `frontend/src/app/(app)/designs/page.tsx`
- Create: `frontend/src/app/(app)/renders/page.tsx`

**Step 1: Create designs page**

Create `frontend/src/app/(app)/designs/page.tsx`:
```tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Upload, Trash2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Design {
  id: string
  name: string
  imagePath: string
  createdAt: string
}

export default function DesignsPage() {
  const [designs, setDesigns] = useState<Design[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getDesigns().then(setDesigns)
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      const design = await api.uploadDesign(file)
      setDesigns((prev) => [design, ...prev])
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this design?')) return
    await api.deleteDesign(id)
    setDesigns((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Designs</h1>
        <button onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
          <Upload size={20} /> Upload Design
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {designs.map((d) => (
          <div key={d.id} className="group relative rounded-xl border bg-white overflow-hidden">
            <img src={`${API_URL}/api/mockup-sets/uploads/${d.imagePath}`} alt={d.name}
              className="w-full aspect-square object-cover" />
            <div className="p-2">
              <p className="text-sm truncate">{d.name}</p>
            </div>
            <button onClick={() => handleDelete(d.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded-full bg-white p-2 shadow hover:bg-red-50 transition-opacity">
              <Trash2 size={14} className="text-red-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create renders page**

Create `frontend/src/app/(app)/renders/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Download } from 'lucide-react'

interface MockupSet {
  id: string
  name: string
  templates: { id: string }[]
}

export default function RendersPage() {
  const [sets, setSets] = useState<MockupSet[]>([])

  useEffect(() => {
    api.getSets().then(setSets)
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Renders</h1>
      <p className="text-gray-500">Select a mockup set to apply a design and generate renders.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {sets.map((set) => (
          <a key={set.id} href={`/sets/${set.id}/apply`}
            className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow">
            <h3 className="font-semibold">{set.name}</h3>
            <p className="text-gray-400 text-sm mt-1">{set.templates.length} template(s)</p>
            <div className="mt-3 flex items-center gap-1 text-blue-600 text-sm">
              <Download size={14} /> Apply design & render
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: designs library and renders pages"
```

---

## Phase 5: Integration & Polish

### Task 15: Static file serving for uploads

**Files:**
- Modify: `backend/src/index.ts`

**Step 1: Add static file serving**

Add to `backend/src/index.ts` before routes:
```typescript
import path from 'path'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const RENDER_DIR = process.env.RENDER_DIR || './rendered'

app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/rendered', express.static(RENDER_DIR))
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: static file serving for uploads and renders"
```

---

### Task 16: End-to-End Smoke Test

**Step 1: Start all services**

Run: `docker compose up --build`

**Step 2: Verify each service health endpoint**

Run:
```bash
curl http://localhost:4000/health
curl http://localhost:5000/health
curl http://localhost:3000
```

Expected: JSON `{"status":"ok"}` from backend and processing, HTML from frontend.

**Step 3: Manual walkthrough**

1. Open http://localhost:3000 — should redirect to /login
2. Sign up with email/password
3. Create a mockup set
4. Upload a product photo
5. Open template editor, drag corners
6. Save overlay config
7. Upload a design
8. Apply design to set, trigger render
9. Download rendered mockup

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from smoke test"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Scaffolding | 1-2 | Docker Compose, 3 services, DB schema |
| 2: Backend API | 3-7 | Auth, CRUD for sets/templates/designs, batch render |
| 3: Image Processing | 8-9 | Perspective transform, displacement, texture detection |
| 4: Frontend | 10-14 | Auth pages, dashboard, set editor, template canvas editor, apply design |
| 5: Integration | 15-16 | Static files, smoke test |
