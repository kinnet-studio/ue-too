import {
    convertFromCanvas2ViewPort,
    convertFromViewport2World,
    convertFromWindow2Canvas,
    getScrollBar,
} from '@ue-too/board';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import { usePixiCanvas } from '../../contexts';
import { useAllBoardCameraState } from '../../hooks/pixi/camera';

export const useCanvasSize = () => {
    const { result } = usePixiCanvas();
    const cachedSizeRef = useRef<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });

    return useSyncExternalStore(
        cb => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null
            ) {
                return () => { };
            }
            result.components.app.renderer.on('resize', cb);
            return () => {
                if (result.components.app.renderer == null) {
                    return;
                }
                result.components.app.renderer.off('resize', cb);
            };
        },
        () => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null
            ) {
                if (
                    cachedSizeRef.current.width === 0 &&
                    cachedSizeRef.current.height === 0
                ) {
                    return cachedSizeRef.current;
                }
                cachedSizeRef.current = { width: 0, height: 0 };
                return cachedSizeRef.current;
            }

            const currentSize = {
                width: result.components.app.renderer.width,
                height: result.components.app.renderer.height,
            };
            if (
                currentSize.width === cachedSizeRef.current.width &&
                currentSize.height === cachedSizeRef.current.height
            ) {
                return cachedSizeRef.current;
            }
            cachedSizeRef.current = currentSize;
            return currentSize;
        }
    );
};

export const useViewportScrollBar = () => {
    const { result } = usePixiCanvas();

    const cameraState = useAllBoardCameraState();
    // A resize changes the camera's viewport size without a camera event; the
    // camera's own resize listener (registered at init) runs before this one.
    const canvasSize = useCanvasSize();

    const res = useMemo(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.camera == null
        ) {
            return {
                horizontalLength: undefined,
                verticalLength: undefined,
                horizontal: undefined,
                vertical: undefined,
            };
        }
        return getScrollBar(result.components.camera);
    }, [result, cameraState, canvasSize]);

    return res;
};

export const useCoordinateConversion = () => {
    const { result } = usePixiCanvas();
    return useCallback(
        (event: PointerEvent) => {
            event.preventDefault();
            const point = { x: event.clientX, y: event.clientY };
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.camera == null
            ) {
                return { x: 0, y: 0 };
            }

            const canvasPoint = convertFromWindow2Canvas(
                point,
                result.components.canvasProxy
            );
            const viewportPoint = convertFromCanvas2ViewPort(
                canvasPoint,
                {
                    x: result.components.canvasProxy.width / 2,
                    y: result.components.canvasProxy.height / 2,
                },
                false
            );
            const worldPoint = convertFromViewport2World(
                viewportPoint,
                result.components.camera.position,
                result.components.camera.zoomLevel,
                result.components.camera.rotation,
                false
            );

            return worldPoint;
        },
        [result]
    );
};
