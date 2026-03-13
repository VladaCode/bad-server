import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    let statusCode = err.statusCode || 500
    let message = err.message || 'Server error'

    if (err.code === 'EBADCSRFTOKEN') {
        statusCode = 403
        message = 'Invalid CSRF token'
    }

    if (err.name === 'MulterError') {
        statusCode = 400
        message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message
    }

    if (statusCode === 500) {
        message = 'Internal server error'
    }

    if (process.env.NODE_ENV !== 'production') {
        console.error(err)
    }

    res.status(statusCode).send({ message })
}

export default errorHandler
