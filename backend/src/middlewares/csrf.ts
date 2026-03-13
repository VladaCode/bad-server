import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'

const CSRF_COOKIE_NAME = '_csrf'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const isProduction = process.env.NODE_ENV === 'production'

const createToken = () => crypto.randomBytes(32).toString('hex')

const setCsrfCookie = (res: Response, token: string) => {
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
    })
}

export const getCsrfToken = (
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    const token = createToken()
    setCsrfCookie(res, token)
    res.status(200).json({ csrfToken: token })
}

export const csrfProtection = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    if (SAFE_METHODS.has(req.method)) {
        next()
        return
    }

    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME]
    const csrfHeader = req.header('X-CSRF-Token')

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        const error = new Error('Invalid CSRF token') as Error & {
            code?: string
            statusCode?: number
        }
        error.code = 'EBADCSRFTOKEN'
        error.statusCode = 403
        next(error)
        return
    }

    next()
}
