import { promises as fs } from 'fs'
import { constants } from 'http2'
import { NextFunction, Request, Response } from 'express'
import sharp from 'sharp'
import BadRequestError from '../errors/bad-request-error'

const FILE_MIN_SIZE = 2 * 1024

const deleteIfExists = async (filePath: string) => {
    try {
        await fs.unlink(filePath)
    } catch (_error) {
        // ignore cleanup errors
    }
}

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('File was not uploaded'))
    }

    try {
        if (req.file.size < FILE_MIN_SIZE) {
            await deleteIfExists(req.file.path)
            return next(new BadRequestError('File is too small'))
        }

        const metadata = await sharp(req.file.path).metadata()
        const hasValidMeta =
            Boolean(metadata.format) &&
            Boolean(metadata.width) &&
            Boolean(metadata.height)

        if (!hasValidMeta) {
            await deleteIfExists(req.file.path)
            return next(new BadRequestError('Invalid image metadata'))
        }

        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${req.file.filename}`
            : `/${req.file.filename}`

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: req.file.originalname,
        })
    } catch (_error) {
        await deleteIfExists(req.file.path)
        return next(new BadRequestError('Invalid image file'))
    }
}

export default {}
