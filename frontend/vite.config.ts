import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    plugins: [svgr(), react(), tsconfigPaths({ root: __dirname })],
    resolve: {
        alias: {
            $fonts: resolve(__dirname, 'src/vendor/fonts'),
            $assets: resolve(__dirname, 'src/assets'),
        },
    },
    build: {
        assetsInlineLimit: 0,
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `
                    @use "/src/scss/variables" as *;
                    @use "/src/scss/mixins" as mixins;
                `,
            },
        },
    },
})

