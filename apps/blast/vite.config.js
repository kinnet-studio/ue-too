import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { join, resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), vue()],
    root: resolve(__dirname, './src'),
    publicDir: resolve(__dirname, 'public'),
    build: {
        // Its own folder: the apps build in parallel, and emptying the shared
        // dist/ races with the other apps writing into it
        outDir: resolve(join(__dirname, '../../'), 'dist/apps/blast'),
        emptyOutDir: true,
        sourcemap: true,
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
            },
        },
    },
    assetsInclude: [
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif',
        '**/*.svg',
        '**/*.webp',
    ],
    server: {
        host: true,
        strictPort: false,
    },
});
