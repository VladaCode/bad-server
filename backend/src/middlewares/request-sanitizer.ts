import { NextFunction, Request, Response } from 'express'
import BadRequestError from '../errors/bad-request-error'

const MAX_DEPTH = 20
const MAX_STRING_LENGTH = 5000
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

const validatePayload = (value: unknown, depth = 0) => {
    if (depth > MAX_DEPTH) {
        throw new BadRequestError('Input is too deeply nested')
    }

    if (value === null || value === undefined) {
        return
    }

    if (typeof value === 'string') {
        if (value.length > MAX_STRING_LENGTH) {
            throw new BadRequestError('String value is too long')
        }
        return
    }

    if (Array.isArray(value)) {
        value.forEach((item) => validatePayload(item, depth + 1))
        return
    }

    if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(
            ([key, nestedValue]) => {
                if (
                    FORBIDDEN_KEYS.has(key) ||
                    key.includes('$') ||
                    key.includes('.') ||
                    key.includes('[') ||
                    key.includes(']')
                ) {
                    throw new BadRequestError('Unsafe key in payload')
                }

                validatePayload(nestedValue, depth + 1)
            }
        )
    }
}

export const requestSanitizer = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        validatePayload(req.query)
        validatePayload(req.params)
        validatePayload(req.body)
        next()
    } catch (error) {
        next(error)
    }
}
