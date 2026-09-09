import {
    BaseAppComponents,
    InitAppOptions,
} from '@ue-too/board-pixi-integration';
import { useEffect, useRef } from 'react';

import { usePixiCanvas } from '../../contexts/pixi';
import { teardownComponents } from './teardown';

/**
 * Initializes a Pixi application into a container element and tears it down on
 * unmount. Attach the returned `containerRef` to a wrapping element; a fresh
 * `<canvas>` is created inside it for each initialization.
 *
 * The design below prevents a class of WebGL-context bugs that hard-freeze the
 * GPU process on some drivers (notably Linux/Mesa):
 *
 * 1. **Init runs once per mount.** Callers routinely pass an inline `option`
 *    object and `initFunction` closure, so keying the effect on them would
 *    re-initialize Pixi on every render — destroying and recreating the GL
 *    context on the same canvas, which collides with the in-flight renderer
 *    and wedges the GPU. The latest values are read from refs instead, so the
 *    effect depends only on the stable `setResult`.
 * 2. **Init/teardown are serialized** through a promise chain, so two
 *    initializations never overlap (e.g. React StrictMode's mount→unmount→
 *    mount in dev, or a fast remount). The previous context is fully destroyed
 *    before the next one is created.
 * 3. **A fresh `<canvas>` per init.** Pixi calls `WEBGL_lose_context` when the
 *    renderer is destroyed; a canvas whose context was lost cannot be
 *    reinitialized, so each init gets a brand-new element and the old one is
 *    detached on teardown (`removeView`).
 */
export const useInitializePixiApp = <T extends InitAppOptions = InitAppOptions>(
    option: Partial<T>,
    initFunction: (
        canvas: HTMLCanvasElement,
        option: Partial<T>
    ) => Promise<BaseAppComponents>,
    className?: string
) => {
    const { setResult } = usePixiCanvas<BaseAppComponents>();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const appComponentsRef = useRef<BaseAppComponents | null>(null);

    // Latest values, read at init time without being effect dependencies (1).
    const optionRef = useRef(option);
    const initFunctionRef = useRef(initFunction);
    const classNameRef = useRef(className);
    optionRef.current = option;
    initFunctionRef.current = initFunction;
    classNameRef.current = className;

    // Serializes init/teardown so two runs never overlap (2).
    const chainRef = useRef<Promise<void>>(Promise.resolve());

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let cancelled = false;

        // Runs every registered cleanup, then destroys the app; `removeView`
        // discards the <canvas> rather than reusing it (3).
        const teardown = (components: BaseAppComponents | null) => {
            if (!components) return;
            teardownComponents(components);
        };

        const run = chainRef.current
            .then(async () => {
                if (cancelled) return;

                // Tear down a leftover app from a previous run before starting.
                if (appComponentsRef.current) {
                    setResult({ initialized: false });
                    teardown(appComponentsRef.current);
                    appComponentsRef.current = null;
                }

                const canvas = document.createElement('canvas');
                if (classNameRef.current) {
                    canvas.className = classNameRef.current;
                }
                container.appendChild(canvas);

                const components = await initFunctionRef.current(
                    canvas,
                    optionRef.current
                );

                if (cancelled) {
                    // Unmounted while initializing — discard immediately.
                    teardown(components);
                    return;
                }

                appComponentsRef.current = components;
                setResult({
                    initialized: true,
                    success: true,
                    components,
                });
            })
            .catch(error => {
                console.error('Failed to initialize PixiJS:', error);
                setResult({ initialized: true, success: false });
            });

        chainRef.current = run;

        // Cleanup function
        return () => {
            cancelled = true;
            // Chain teardown after this run so we never destroy an app that is
            // still initializing.
            chainRef.current = run.then(() => {
                if (appComponentsRef.current) {
                    setResult({ initialized: false });
                    teardown(appComponentsRef.current);
                    appComponentsRef.current = null;
                }
            });
        };
    }, [setResult]);

    return { containerRef };
};
