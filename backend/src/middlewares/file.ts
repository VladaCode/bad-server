import crypto from 'crypto'
import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { mkdirSync } from 'fs'
import { join } from 'path'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const FILE_MAX_SIZE = 10 * 1024 * 1024

const MIME_EXTENSION_MAP: Record<string, string> = {
    'image/png': 'png',
    'image/jpg': 'jpg',
    'image/jpeg': 'jpeg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
}

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        const destinationPath = join(
            __dirname,
            process.env.UPLOAD_PATH_TEMP
                ? `../public/${process.env.UPLOAD_PATH_TEMP}`
                : '../public'
        )

        mkdirSync(destinationPath, { recursive: true })
        cb(null, destinationPath)
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const extension = MIME_EXTENSION_MAP[file.mimetype]
        if (!extension) {
            cb(new Error('Unsupported file type'), '')
            return
        }

        cb(null, `${crypto.randomUUID()}.${extension}`)
    },
})

const allowedTypes = Object.keys(MIME_EXTENSION_MAP)

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (!allowedTypes.includes(file.mimetype)) {
        cb(new Error('Unsupported file type'))
        return
    }

    cb(null, true)
}

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: FILE_MAX_SIZE,
        files: 1,
    },
})
