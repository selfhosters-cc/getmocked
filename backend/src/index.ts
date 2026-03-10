import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRouter from './routes/auth.js'
import mockupSetsRouter from './routes/mockup-sets.js'
import templatesRouter from './routes/templates.js'
import designsRouter from './routes/designs.js'
import renderRouter from './routes/render.js'
import passport from './lib/passport.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use(passport.initialize())

app.use('/api/auth', authRouter)
app.use('/api/mockup-sets', mockupSetsRouter)
app.use('/api/mockup-sets', templatesRouter)
app.use('/api/designs', designsRouter)
app.use('/api/render', renderRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
