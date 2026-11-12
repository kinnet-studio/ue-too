import { join, resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/ue-too/',
    root: resolve(__dirname, './src'),
    build: {
        outDir: resolve(join(__dirname, '../../'), 'dist'),
        emptyOutDir: true,
        sourcemap: true,
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                base: resolve(__dirname, 'src/base/index.html'),
                'attach-detach': resolve(
                    __dirname,
                    'src/attach-detach/index.html'
                ),
                ruler: resolve(__dirname, 'src/ruler/index.html'),
                navigation: resolve(__dirname, 'src/navigation/index.html'),
                'pixi-integration': resolve(
                    __dirname,
                    'src/pixi-integration/index.html'
                ),
                'konva-integration': resolve(
                    __dirname,
                    'src/konva-integration/index.html'
                ),
                'fabric-integration': resolve(
                    __dirname,
                    'src/fabric-integration/index.html'
                ),
                'camera-animation': resolve(
                    __dirname,
                    'src/camera-animation/index.html'
                ),
                'image-example': resolve(
                    __dirname,
                    'src/image-example/index.html'
                ),
                physics: resolve(__dirname, 'src/physics/index.html'),
                svg: resolve(__dirname, 'src/svg/index.html'),
                'pele-mermaid': resolve(
                    __dirname,
                    'src/pele-mermaid/index.html'
                ),
                'state-machine-visualizer': resolve(
                    __dirname,
                    'src/state-machine-visualizer/index.html'
                ),
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
        strictPort: false,
    },
});
