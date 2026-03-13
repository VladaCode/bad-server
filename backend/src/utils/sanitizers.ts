import validator from 'validator'
import escapeRegExp from './escapeRegExp'

const normalizeInteger = (
    value: unknown,
    fallback: number,
    min = 1,
    max = Number.MAX_SAFE_INTEGER
) => {
    const parsed = Number(value)
    if (!Number.isInteger(parsed)) {
        return fallback
    }

    if (parsed < min) {
        return min
    }

    if (parsed > max) {
        return max
    }

    return parsed
}

export const normalizePagination = (
    pageRaw: unknown,
    limitRaw: unknown,
    defaultLimit = 10,
    maxLimit = 10
) => {
    const page = normalizeInteger(pageRaw, 1, 1)
    const limit = normalizeInteger(limitRaw, defaultLimit, 1, maxLimit)

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    }
}

export const normalizeSearchRegex = (value: unknown) => {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    const safePattern = escapeRegExp(trimmed)
    return new RegExp(safePattern, 'i')
}

export const sanitizePlainText = (
    value: unknown,
    maxLength = 500
): string => {
    if (typeof value !== 'string') {
        return ''
    }

    return validator.escape(value.trim().slice(0, maxLength))
}
