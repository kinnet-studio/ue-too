import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePixiCanvas } from '../../contexts/pixi';
import { useViewportScrollBar } from '../../hooks/pixi/utils';
import {
    scrollBarDragToWorldDelta,
    scrollBarKeyToWorldDelta,
} from './scrollbar-pan';

export const ScrollBarDisplay = () => {
    const scrollBar = useViewportScrollBar();
    const initialHorizontalPositionRef = useRef<number>(0);
    const isHorizontalPointerDownRef = useRef<boolean>(false);

    const initialVerticalPositionRef = useRef<number>(0);
    const isVerticalPointerDownRef = useRef<boolean>(false);

    const { result } = usePixiCanvas();

    const hideAfterMs = 3000;
    const fadeMs = 180;
    const hideTimeoutRef = useRef<number | undefined>(undefined);
    const [isVisible, setIsVisible] = useState<boolean>(false);

    const [isHorizontalHovered, setIsHorizontalHovered] =
        useState<boolean>(false);
    const [isHorizontalActive, setIsHorizontalActive] = useState<boolean>(false);
    const [isHorizontalFocused, setIsHorizontalFocused] =
        useState<boolean>(false);
    const [isVerticalHovered, setIsVerticalHovered] = useState<boolean>(false);
    const [isVerticalActive, setIsVerticalActive] = useState<boolean>(false);
    const [isVerticalFocused, setIsVerticalFocused] = useState<boolean>(false);

    const clearHideTimeout = useCallback(() => {
        if (hideTimeoutRef.current == null) {
            return;
        }
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
    }, []);

    const scheduleHide = useCallback(() => {
        clearHideTimeout();
        hideTimeoutRef.current = window.setTimeout(() => {
            setIsVisible(false);
        }, hideAfterMs);
    }, [clearHideTimeout]);

    useEffect(() => {
        return () => {
            clearHideTimeout();
        };
    }, [clearHideTimeout]);

    const hasScrollBars =
        (scrollBar.horizontalLength ?? 0) > 0 || (scrollBar.verticalLength ?? 0) > 0;

    useEffect(() => {
        if (!hasScrollBars) {
            setIsVisible(false);
            return;
        }
        setIsVisible(true);
        scheduleHide();
    }, [
        hasScrollBars,
        scrollBar.horizontal,
        scrollBar.vertical,
        scrollBar.horizontalLength,
        scrollBar.verticalLength,
        scheduleHide,
    ]);

    const themeThumbColor = useMemo(() => {
        if (isHorizontalActive || isVerticalActive) {
            return 'var(--scrollbar-thumb-active, rgba(127, 127, 127, 0.65))';
        }
        if (isHorizontalHovered || isVerticalHovered) {
            return 'var(--scrollbar-thumb-hover, rgba(127, 127, 127, 0.55))';
        }
        return 'var(--scrollbar-thumb, rgba(127, 127, 127, 0.45))';
    }, [
        isHorizontalActive,
        isVerticalActive,
        isHorizontalHovered,
        isVerticalHovered,
    ]);

    const focusOutline = '2px solid var(--ring, #0066cc)';
    const shouldShow =
        (hasScrollBars && isVisible) ||
        isHorizontalHovered ||
        isVerticalHovered ||
        isHorizontalActive ||
        isVerticalActive ||
        isHorizontalFocused ||
        isVerticalFocused;

    const horizontalPointerDown = (
        event: React.PointerEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        initialHorizontalPositionRef.current = event.clientX;
        isHorizontalPointerDownRef.current = true;
        setIsHorizontalActive(true);
        setIsVisible(true);
        clearHideTimeout();
    };

    const horizontalPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null ||
                isHorizontalPointerDownRef.current == false
            ) {
                initialHorizontalPositionRef.current = 0;
                return;
            }
            const delta = event.clientX - initialHorizontalPositionRef.current;
            initialHorizontalPositionRef.current = event.clientX;

            result.components.cameraRig.panByWorld(
                scrollBarDragToWorldDelta(
                    result.components.camera,
                    'horizontal',
                    delta
                )
            );
        },
        [result]
    );

    const horizontalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        isHorizontalPointerDownRef.current = false;
        setIsHorizontalActive(false);
        scheduleHide();
    };

    const horizontalPointerCancel = (
        event: React.PointerEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        isHorizontalPointerDownRef.current = false;
        setIsHorizontalActive(false);
        scheduleHide();
    };

    const horizontalKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null
            ) {
                return;
            }

            const worldDelta = scrollBarKeyToWorldDelta(
                result.components.camera,
                'horizontal',
                event.key
            );
            if (worldDelta == null) {
                return;
            }
            event.preventDefault();

            result.components.cameraRig.panByWorld(worldDelta);
        },
        [result]
    );

    const verticalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        initialVerticalPositionRef.current = event.clientY;
        isVerticalPointerDownRef.current = true;
        setIsVerticalActive(true);
        setIsVisible(true);
        clearHideTimeout();
    };

    const verticalPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null ||
                isVerticalPointerDownRef.current == false
            ) {
                initialVerticalPositionRef.current = 0;
                return;
            }
            const delta = event.clientY - initialVerticalPositionRef.current;
            initialVerticalPositionRef.current = event.clientY;

            result.components.cameraRig.panByWorld(
                scrollBarDragToWorldDelta(
                    result.components.camera,
                    'vertical',
                    delta
                )
            );
        },
        [result]
    );

    const verticalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        isVerticalPointerDownRef.current = false;
        setIsVerticalActive(false);
        scheduleHide();
    };

    const verticalPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        isVerticalPointerDownRef.current = false;
        setIsVerticalActive(false);
        scheduleHide();
    };

    const verticalKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.app.renderer == null
            ) {
                return;
            }

            const worldDelta = scrollBarKeyToWorldDelta(
                result.components.camera,
                'vertical',
                event.key
            );
            if (worldDelta == null) {
                return;
            }
            event.preventDefault();

            result.components.cameraRig.panByWorld(worldDelta);
        },
        [result]
    );

    // Calculate scroll position percentages for ARIA attributes
    const horizontalScrollPercentage = useMemo(() => {
        if (
            scrollBar.horizontal == null ||
            scrollBar.horizontalLength == null ||
            result.initialized == false ||
            result.success == false ||
            result.components.camera == null
        ) {
            return undefined;
        }
        const viewportWidth = result.components.camera.viewPortWidth;
        const maxPosition = viewportWidth - scrollBar.horizontalLength;
        if (maxPosition <= 0) return 0;
        return Math.round((scrollBar.horizontal / maxPosition) * 100);
    }, [scrollBar.horizontal, scrollBar.horizontalLength, result]);

    const verticalScrollPercentage = useMemo(() => {
        if (
            scrollBar.vertical == null ||
            scrollBar.verticalLength == null ||
            result.initialized == false ||
            result.success == false ||
            result.components.camera == null
        ) {
            return undefined;
        }
        const viewportHeight = result.components.camera.viewPortHeight;
        const maxPosition = viewportHeight - scrollBar.verticalLength;
        if (maxPosition <= 0) return 0;
        return Math.round((scrollBar.vertical / maxPosition) * 100);
    }, [scrollBar.vertical, scrollBar.verticalLength, result]);

    return (
        <>
            {/* Horizontal scroll bar */}
            <div
                className="pointer-events-auto"
                tabIndex={shouldShow ? 0 : -1}
                role="scrollbar"
                aria-label="Horizontal scrollbar"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={horizontalScrollPercentage ?? 0}
                style={{
                    width: scrollBar.horizontalLength ?? 0,
                    height: 10,
                    left: scrollBar.horizontal ?? 0,
                    bottom: 2,
                    backgroundColor: themeThumbColor,
                    position: 'absolute',
                    outline: 'none',
                    borderRadius: 999,
                    opacity: shouldShow ? 0.9 : 0,
                    transition:
                        `opacity ${fadeMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 120ms ease, transform 120ms ease`,
                    transform: isHorizontalActive ? 'scaleY(1.15)' : undefined,
                    pointerEvents: shouldShow ? 'auto' : 'none',
                }}
                onPointerDown={horizontalPointerDown}
                onPointerMove={horizontalPointerMove}
                onPointerUp={horizontalPointerUp}
                onPointerCancel={horizontalPointerCancel}
                onPointerEnter={() => setIsHorizontalHovered(true)}
                onPointerLeave={() => {
                    setIsHorizontalHovered(false);
                    setIsHorizontalActive(false);
                    isHorizontalPointerDownRef.current = false;
                    scheduleHide();
                }}
                onKeyDown={horizontalKeyDown}
                onFocus={e => {
                    e.currentTarget.style.outline = focusOutline;
                    e.currentTarget.style.outlineOffset = '2px';
                    setIsHorizontalFocused(true);
                    setIsVisible(true);
                    clearHideTimeout();
                }}
                onBlur={e => {
                    e.currentTarget.style.outline = 'none';
                    setIsHorizontalFocused(false);
                    scheduleHide();
                }}
            />
            {/* Vertical scroll bar */}
            <div
                className="pointer-events-auto"
                tabIndex={shouldShow ? 0 : -1}
                role="scrollbar"
                aria-label="Vertical scrollbar"
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={verticalScrollPercentage ?? 0}
                style={{
                    width: 10,
                    height: scrollBar.verticalLength ?? 0,
                    right: 2,
                    top: scrollBar.vertical ?? 0,
                    backgroundColor: themeThumbColor,
                    position: 'absolute',
                    outline: 'none',
                    borderRadius: 999,
                    opacity: shouldShow ? 0.9 : 0,
                    transition:
                        `opacity ${fadeMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 120ms ease, transform 120ms ease`,
                    transform: isVerticalActive ? 'scaleX(1.15)' : undefined,
                    pointerEvents: shouldShow ? 'auto' : 'none',
                }}
                onPointerDown={verticalPointerDown}
                onPointerMove={verticalPointerMove}
                onPointerUp={verticalPointerUp}
                onPointerCancel={verticalPointerCancel}
                onPointerEnter={() => setIsVerticalHovered(true)}
                onPointerLeave={() => {
                    setIsVerticalHovered(false);
                    setIsVerticalActive(false);
                    isVerticalPointerDownRef.current = false;
                    scheduleHide();
                }}
                onKeyDown={verticalKeyDown}
                onFocus={e => {
                    e.currentTarget.style.outline = focusOutline;
                    e.currentTarget.style.outlineOffset = '2px';
                    setIsVerticalFocused(true);
                    setIsVisible(true);
                    clearHideTimeout();
                }}
                onBlur={e => {
                    e.currentTarget.style.outline = 'none';
                    setIsVerticalFocused(false);
                    scheduleHide();
                }}
            />
        </>
    );
};
