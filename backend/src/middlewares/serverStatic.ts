import express from 'express'

export default function serveStatic(baseDir: string) {
    return express.static(baseDir, {
        dotfiles: 'deny',
        etag: true,
        fallthrough: true,
        index: false,
        redirect: false,
    })
}
