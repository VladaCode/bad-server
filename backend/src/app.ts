import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS } from './config'
import { csrfProtection } from './middlewares/csrf'
import errorHandler from './middlewares/error-handler'
import { globalRateLimiter } from './middlewares/rate-limit'
import { requestSanitizer } from './middlewares/request-sanitizer'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000 } = process.env
const { ORIGIN_ALLOW = 'http://localhost:5173' } = process.env
const app = express()

const corsOptions = {
    origin: ORIGIN_ALLOW,
    credentials: true,
}

app.set('query parser', 'simple')
app.set('trust proxy', 1)

app.use(cookieParser())
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
)
app.use(globalRateLimiter)

app.use(
    urlencoded({
        extended: false,
        limit: '100kb',
        parameterLimit: 100,
    })
)
app.use(json({ limit: '100kb' }))

app.use(requestSanitizer)
app.use(csrfProtection)

app.use(serveStatic(path.join(__dirname, 'public')))
app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT, () => console.log('ok'))
    } catch (error) {
        console.error(error)
    }
}

bootstrap()
