import rateLimit from 'express-rate-limit'

const points = Number(process.env.RATE_LIMIT_POINTS || 10)
const duration = Number(process.env.RATE_LIMIT_DURATION || 60)

export const globalRateLimiter = rateLimit({
    windowMs: duration * 1000,
    max: Number.isFinite(points) ? points : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests' },
    skip: (req) => req.path === '/auth/csrf-token',
})
