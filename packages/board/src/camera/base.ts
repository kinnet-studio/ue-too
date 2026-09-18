import { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import { BoardCamera } from './interface';
import {
    convert2ViewPortSpaceAnchorAtCenter,
    convert2WorldSpaceAnchorAtCenter,
} from './utils/coordinate-conversion';
import {
    TransformationMatrix,
    decomposeCameraMatrix,
    decomposeTRS,
} from './utils/matrix';
import { Boundaries, withinBoundaries } from './utils/position';
import {
    RotationLimits,
    clampRotation,
    normalizeAngleZero2TwoPI,
    rotationWithinLimits,
} from './utils/rotation';
import {
    ZoomLevelLimits,
    clampZoomLevel,
    zoomLevelWithinLimits,
} from './utils/zoom';

/**
 * The camera mutates its limit objects in place (setMinZoomLevel,
 * setHorizontalBoundaries, ...), so it must never hold a caller's object —
 * least of all a shared default such as DEFAULT_BOARD_CAMERA_ZOOM_BOUNDARIES,
 * which would leak one camera's limits into every camera created after it.
 */
function copyBoundaries(boundaries: Boundaries | undefined): Boundaries | undefined {
    if (boundaries === undefined) {
        return undefined;
    }
    return {
        ...(boundaries.min !== undefined ? { min: { ...boundaries.min } } : {}),
        ...(boundaries.max !== undefined ? { max: { ...boundaries.max } } : {}),
    };
}

function copyZoomLevelLimits(limits: ZoomLevelLimits | undefined): ZoomLevelLimits | undefined {
    return limits === undefined ? undefined : { ...limits };
}

function copyRotationLimits(limits: RotationLimits | undefined): RotationLimits | undefined {
    return limits === undefined ? undefined : { ...limits };
}

export type CameraOptions = {
    viewPortWidth?: number;
    viewPortHeight?: number;
    position?: Point;
    rotation?: number;
    zoomLevel?: number;
    boundaries?: Boundaries;
    zoomLevelBoundaries?: ZoomLevelLimits;
    rotationBoundaries?: RotationLimits;
};

/**
 * Base camera implementation providing core functionality for an infinite canvas system.
 * This is the fundamental building block for camera management in the board package.
 *
 * @remarks
 * BaseCamera is non-observable and does not emit events when state changes.
 * For event-driven camera updates, use {@link DefaultBoardCamera} instead.
 *
 * The camera supports:
 * - Position, rotation, and zoom transformations
 * - Configurable boundaries for position, zoom, and rotation
 * - Coordinate conversion between viewport and world space
 * - Transformation matrix caching for performance
 * - High-DPI display support via devicePixelRatio
 *
 * @example
 * ```typescript
 * // Create a camera for a 1920x1080 viewport
 * const camera = new BaseCamera(1920, 1080, { x: 0, y: 0 }, 0, 1.0);
 *
 * // Set boundaries to constrain camera movement
 * camera.setHorizontalBoundaries(-5000, 5000);
 * camera.setVerticalBoundaries(-5000, 5000);
 *
 * // Update camera state
 * camera.setPosition({ x: 100, y: 200 });
 * camera.setZoomLevel(2.0);
 * camera.setRotation(Math.PI / 6);
 *
 * // Get transformation matrix for rendering
 * const transform = camera.getTransform(window.devicePixelRatio, true);
 * ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
 * ```
 *
 * @category Camera
 * @see {@link DefaultBoardCamera} for observable camera with event support
 * @see {@link CameraRig} for high-level camera control with input handling
 */
export default class BaseCamera implements BoardCamera {
    private _position: Point;
    private _rotation: number;
    private _zoomLevel: number;

    private currentCachedTransform:
        | {
            transform: {
                a: number;
                b: number;
                c: number;
                d: number;
                e: number;
                f: number;
            };
            position: Point;
            rotation: number;
            zoomLevel: number;
            alignCoorindate: boolean;
            devicePixelRatio: number;
            viewPortWidth: number;
            viewPortHeight: number;
        }
        | undefined;

    private currentCachedTRS:
        | {
            scale: { x: number; y: number };
            rotation: number;
            translation: { x: number; y: number };
            transformMatrix: TransformationMatrix;
        }
        | undefined;

    private _viewPortWidth: number;
    private _viewPortHeight: number;

    private _boundaries?: Boundaries;
    private _zoomBoundaries?: ZoomLevelLimits;
    private _rotationBoundaries?: RotationLimits;

    /**
     * Creates a new BaseCamera instance with specified viewport size and optional constraints.
     *
     * @param viewPortWidth - Width of the viewport in CSS pixels (default: 1000)
     * @param viewPortHeight - Height of the viewport in CSS pixels (default: 1000)
     * @param position - Initial camera position in world coordinates (default: {x: 0, y: 0})
     * @param rotation - Initial rotation in radians (default: 0)
     * @param zoomLevel - Initial zoom level, where 1.0 = 100% (default: 1.0)
     * @param boundaries - Position constraints in world space (default: ±10000 on both axes)
     * @param zoomLevelBoundaries - Zoom constraints (default: 0.1 to 10)
     * @param rotationBoundaries - Optional rotation constraints (default: undefined, unrestricted)
     *
     * @example
     * ```typescript
     * // Basic camera with defaults
     * const camera = new BaseCamera();
     *
     * // Camera with custom viewport and position
     * const camera2 = new BaseCamera(
     *   1920, 1080,
     *   { x: 500, y: 300 },
     *   0,
     *   1.5
     * );
     *
     * // Camera with all constraints
     * const camera3 = new BaseCamera(
     *   1920, 1080,
     *   { x: 0, y: 0 },
     *   0,
     *   1.0,
     *   { min: { x: -2000, y: -2000 }, max: { x: 2000, y: 2000 } },
     *   { min: 0.5, max: 5 },
     *   { start: 0, end: Math.PI / 2 }
     * );
     * ```
     */
    constructor(options: CameraOptions) {
        const {
            viewPortWidth = 1000,
            viewPortHeight = 1000,
            position = { x: 0, y: 0 },
            rotation = 0,
            zoomLevel = 1,
            boundaries = {
                min: { x: -10000, y: -10000 },
                max: { x: 10000, y: 10000 },
            },
            zoomLevelBoundaries = { min: 0.1, max: 10 },
            rotationBoundaries = undefined,
        } = options;
        this._position = position;
        this._zoomLevel = zoomLevel;
        this._rotation = rotation;
        this._viewPortHeight = viewPortHeight;
        this._viewPortWidth = viewPortWidth;
        this._zoomBoundaries = copyZoomLevelLimits(zoomLevelBoundaries);
        this._rotationBoundaries = copyRotationLimits(rotationBoundaries);
        this._boundaries = copyBoundaries(boundaries);
    }

    /**
     * Gets the current position boundaries that constrain camera movement in world coordinates.
     *
     * @returns The boundaries object or undefined if no boundaries are set
     */
    get boundaries(): Boundaries | undefined {
        return this._boundaries;
    }

    /**
     * Sets position boundaries to constrain camera movement in world coordinates.
     *
     * @param boundaries - Boundary constraints or undefined to remove all constraints
     */
    set boundaries(boundaries: Boundaries | undefined) {
        this._boundaries = copyBoundaries(boundaries);
    }

    /**
     * Gets the viewport width in CSS pixels.
     *
     * @returns Current viewport width
     */
    get viewPortWidth(): number {
        return this._viewPortWidth;
    }

    /**
     * Sets the viewport width in CSS pixels.
     * Updates invalidate the cached transformation matrix.
     *
     * @param width - New viewport width in CSS pixels
     */
    set viewPortWidth(width: number) {
        this._viewPortWidth = width;
    }

    /**
     * Gets the viewport height in CSS pixels.
     *
     * @returns Current viewport height
     */
    get viewPortHeight(): number {
        return this._viewPortHeight;
    }

    /**
     * Sets the viewport height in CSS pixels.
     * Updates invalidate the cached transformation matrix.
     *
     * @param height - New viewport height in CSS pixels
     */
    set viewPortHeight(height: number) {
        this._viewPortHeight = height;
    }

    /**
     * Gets the current camera position in world coordinates.
     *
     * @returns A copy of the current position (center of viewport in world space)
     */
    get position(): Point {
        return { ...this._position };
    }

    /**
     * Sets the camera position with boundary validation and floating-point jitter prevention.
     *
     * @param destination - Target position in world coordinates
     * @returns True if position was updated, false if rejected by boundaries or negligible change
     *
     * @remarks
     * Position updates are rejected if:
     * - The destination is outside the configured boundaries
     * - The change magnitude is less than 10E-10
     * - The change magnitude is less than 1/zoomLevel (prevents sub-pixel jitter)
     *
     * @example
     * ```typescript
     * camera.setHorizontalBoundaries(-1000, 1000);
     * camera.setVerticalBoundaries(-1000, 1000);
     *
     * camera.setPosition({ x: 500, y: 500 }); // returns true
     * camera.setPosition({ x: 2000, y: 0 }); // returns false (out of bounds)
     * ```
     */
    setPosition(destination: Point) {
        if (!withinBoundaries(destination, this._boundaries)) {
            return false;
        }
        const diff = PointCal.subVector(destination, this._position);
        if (
            PointCal.magnitude(diff) < 10e-10 &&
            PointCal.magnitude(diff) < 1 / this._zoomLevel
        ) {
            return false;
        }
        this._position = destination;
        return true;
    }

    /**
     * Gets the current zoom level.
     *
     * @returns Current zoom level (1.0 = 100%, 2.0 = 200%, etc.)
     */
    get zoomLevel(): number {
        return this._zoomLevel;
    }

    /**
     * Gets the current zoom level constraints.
     *
     * @returns Zoom boundaries object or undefined if unconstrained
     */
    get zoomBoundaries(): ZoomLevelLimits | undefined {
        return this._zoomBoundaries;
    }

    /**
     * Sets zoom level constraints with automatic min/max swapping if needed.
     *
     * @param zoomBoundaries - Zoom constraints or undefined to remove constraints
     *
     * @remarks
     * If min > max, the values are automatically swapped.
     */
    set zoomBoundaries(zoomBoundaries: ZoomLevelLimits | undefined) {
        const newZoomBoundaries = { ...zoomBoundaries };
        if (
            newZoomBoundaries !== undefined &&
            newZoomBoundaries.min !== undefined &&
            newZoomBoundaries.max !== undefined &&
            newZoomBoundaries.min > newZoomBoundaries.max
        ) {
            let temp = newZoomBoundaries.max;
            newZoomBoundaries.max = newZoomBoundaries.min;
            newZoomBoundaries.min = temp;
        }
        this._zoomBoundaries = newZoomBoundaries;
    }

    /**
     * Sets the maximum allowed zoom level.
     *
     * @param maxZoomLevel - New maximum zoom level
     * @returns True if successfully set, false if conflicts with existing min or current zoom
     *
     * @remarks
     * Returns false if:
     * - The new max is less than the current minimum boundary
     * - The current zoom level exceeds the new maximum
     */
    setMaxZoomLevel(maxZoomLevel: number) {
        if (this._zoomBoundaries == undefined) {
            this._zoomBoundaries = { min: undefined, max: undefined };
        }
        if (
            (this._zoomBoundaries.min != undefined &&
                this._zoomBoundaries.min > maxZoomLevel) ||
            this._zoomLevel > maxZoomLevel
        ) {
            return false;
        }
        this._zoomBoundaries.max = maxZoomLevel;
        return true;
    }

    /**
     * Sets the minimum allowed zoom level.
     *
     * @param minZoomLevel - New minimum zoom level
     * @returns True if successfully set, false if conflicts with existing max
     *
     * @remarks
     * If the current zoom level is below the new minimum, the camera automatically
     * zooms in to match the minimum. Returns false if new min exceeds existing max boundary.
     */
    setMinZoomLevel(minZoomLevel: number) {
        if (this._zoomBoundaries == undefined) {
            this._zoomBoundaries = { min: undefined, max: undefined };
        }
        if (
            this._zoomBoundaries.max != undefined &&
            this._zoomBoundaries.max < minZoomLevel
        ) {
            return false;
        }
        this._zoomBoundaries.min = minZoomLevel;
        if (this._zoomLevel < minZoomLevel) {
            this._zoomLevel = minZoomLevel;
        }
        return true;
    }

    /**
     * Sets the camera zoom level with boundary validation.
     *
     * @param zoomLevel - Target zoom level (1.0 = 100%, 2.0 = 200%, etc.)
     * @returns True if zoom was updated, false if outside boundaries or already at limit
     *
     * @remarks
     * Returns false if:
     * - Zoom level is outside configured boundaries
     * - Already at maximum and trying to zoom beyond it
     * - Already at minimum and trying to zoom below it
     *
     * @example
     * ```typescript
     * camera.setZoomLevel(2.0); // 200% zoom
     * camera.setZoomLevel(0.5); // 50% zoom
     * ```
     */
    setZoomLevel(zoomLevel: number) {
        if (!zoomLevelWithinLimits(zoomLevel, this._zoomBoundaries)) {
            return false;
        }
        if (
            this._zoomBoundaries !== undefined &&
            this._zoomBoundaries.max !== undefined &&
            clampZoomLevel(zoomLevel, this._zoomBoundaries) ==
            this._zoomBoundaries.max &&
            this._zoomLevel == this._zoomBoundaries.max
        ) {
            return false;
        }
        if (
            this._zoomBoundaries !== undefined &&
            this._zoomBoundaries.min !== undefined &&
            clampZoomLevel(zoomLevel, this._zoomBoundaries) ==
            this._zoomBoundaries.min &&
            this._zoomLevel == this._zoomBoundaries.min
        ) {
            return false;
        }
        this._zoomLevel = zoomLevel;
        return true;
    }

    /**
     * Gets the current camera rotation in radians.
     *
     * @returns Current rotation angle (0 to 2π)
     */
    get rotation(): number {
        return this._rotation;
    }

    /**
     * Gets the current rotation constraints.
     *
     * @returns Rotation boundaries or undefined if unconstrained
     */
    get rotationBoundaries(): RotationLimits | undefined {
        return this._rotationBoundaries;
    }

    /**
     * Sets rotation constraints with automatic start/end swapping if needed.
     *
     * @param rotationBoundaries - Rotation limits or undefined to remove constraints
     *
     * @remarks
     * If start > end, the values are automatically swapped.
     */
    set rotationBoundaries(rotationBoundaries: RotationLimits | undefined) {
        const limits = copyRotationLimits(rotationBoundaries);
        if (
            limits !== undefined &&
            limits.start !== undefined &&
            limits.end !== undefined &&
            limits.start > limits.end
        ) {
            let temp = limits.end;
            limits.end = limits.start;
            limits.start = temp;
        }
        this._rotationBoundaries = limits;
    }

    /**
     * Computes the complete transformation matrix from world space to canvas pixel space.
     * Includes caching for performance optimization.
     *
     * @param devicePixelRatio - Device pixel ratio (typically window.devicePixelRatio)
     * @param alignCoorindate - If true, uses standard y-up coordinate system. If false, inverts y-axis
     * @returns Transformation matrix object {a, b, c, d, e, f} with optional cached flag
     *
     * @remarks
     * Transformation order applied:
     * 1. Scale by devicePixelRatio
     * 2. Translate to viewport center
     * 3. Rotate (negated if alignCoorindate is true)
     * 4. Scale by zoom level
     * 5. Translate by camera position
     *
     * The result is cached based on all parameters. Subsequent calls with identical parameters
     * return the cached matrix with `cached: true` flag.
     *
     * @example
     * ```typescript
     * const ctx = canvas.getContext('2d');
     * const transform = camera.getTransform(window.devicePixelRatio, true);
     * ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
     *
     * // Now drawing at world coordinates (100, 200) appears correctly on canvas
     * ctx.fillRect(100, 200, 50, 50);
     * ```
     *
     * @see {@link getTRS} for decomposed transformation components
     */
    getTransform(
        devicePixelRatio: number = 1,
        alignCoorindate: boolean = true
    ) {
        if (
            this.currentCachedTransform !== undefined &&
            this.currentCachedTransform.devicePixelRatio === devicePixelRatio &&
            this.currentCachedTransform.alignCoorindate === alignCoorindate &&
            this.currentCachedTransform.position.x === this._position.x &&
            this.currentCachedTransform.position.y === this._position.y &&
            this.currentCachedTransform.rotation === this._rotation &&
            this.currentCachedTransform.zoomLevel === this._zoomLevel &&
            this.currentCachedTransform.viewPortWidth === this._viewPortWidth &&
            this.currentCachedTransform.viewPortHeight === this._viewPortHeight
        ) {
            return { ...this.currentCachedTransform.transform, cached: true };
        }

        const tx = (devicePixelRatio * this._viewPortWidth) / 2; // 0 if the camera position represents the position at the top left corner of the canvas in the world
        const ty = (devicePixelRatio * this._viewPortHeight) / 2; // 0 if the camera position represents the position at the top left corner of the canvas in the world

        const tx2 = -this._position.x;
        const ty2 = alignCoorindate ? -this._position.y : this._position.y;

        const s = devicePixelRatio;
        const s2 = this._zoomLevel;
        const θ = alignCoorindate ? -this._rotation : this._rotation;

        const sin = Math.sin(θ);
        const cos = Math.cos(θ);

        const a = s2 * s * cos;
        const b = s2 * s * sin;
        const c = -s * s2 * sin;
        const d = s2 * s * cos;
        const e = s * s2 * cos * tx2 - s * s2 * sin * ty2 + tx;
        const f = s * s2 * sin * tx2 + s * s2 * cos * ty2 + ty;
        this.currentCachedTransform = {
            transform: { a, b, c, d, e, f },
            position: this._position,
            rotation: this._rotation,
            zoomLevel: this._zoomLevel,
            alignCoorindate,
            devicePixelRatio,
            viewPortWidth: this._viewPortWidth,
            viewPortHeight: this._viewPortHeight,
        };
        return { a, b, c, d, e, f, cached: false };
    }

    /**
     * Decomposes the transformation matrix into Translation, Rotation, and Scale components.
     *
     * @param devicePixelRatio - Device pixel ratio for high-DPI displays
     * @param alignCoorindate - If true, uses standard y-up coordinate system. If false, inverts y-axis
     * @returns Object containing separate scale, rotation, and translation values
     *
     * @remarks
     * This is useful when you need individual transformation components rather than
     * the combined matrix. Internally calls {@link getTransform} and decomposes the result.
     */
    getTRS(devicePixelRatio: number = 1, alignCoorindate: boolean = true) {
        const transform = this.getTransform(devicePixelRatio, alignCoorindate);
        if (
            this.currentCachedTRS !== undefined &&
            this.currentCachedTRS.transformMatrix.a === transform.a &&
            this.currentCachedTRS.transformMatrix.b === transform.b &&
            this.currentCachedTRS.transformMatrix.c === transform.c &&
            this.currentCachedTRS.transformMatrix.d === transform.d &&
            this.currentCachedTRS.transformMatrix.e === transform.e &&
            this.currentCachedTRS.transformMatrix.f === transform.f
        ) {
            return {
                scale: this.currentCachedTRS.scale,
                rotation: this.currentCachedTRS.rotation,
                translation: this.currentCachedTRS.translation,
                cached: true,
            };
        }
        const decompositionRes = decomposeTRS(transform);
        this.currentCachedTRS = {
            scale: decompositionRes.scale,
            rotation: decompositionRes.rotation,
            translation: decompositionRes.translation,
            transformMatrix: transform,
        };
        return {
            scale: decompositionRes.scale,
            rotation: decompositionRes.rotation,
            translation: decompositionRes.translation,
            cached: false,
        };
    }

    /**
     * Sets camera state by decomposing a transformation matrix.
     * Inverse operation of {@link getTransform}.
     *
     * @param transformationMatrix - 2D transformation matrix to decompose
     *
     * @remarks
     * The matrix is decomposed assuming the same transformation order as {@link getTransform}:
     * Scale(devicePixelRatio) → Translation(viewport center) → Rotation → Zoom → Translation(position)
     *
     * Extracted position, zoom, and rotation values are still validated against boundaries.
     *
     * @example
     * ```typescript
     * // Apply a transformation matrix from an external source
     * const matrix = { a: 2, b: 0, c: 0, d: 2, e: 100, f: 100 };
     * camera.setUsingTransformationMatrix(matrix);
     * ```
     */
    setUsingTransformationMatrix(
        transformationMatrix: TransformationMatrix,
        devicePixelRatio: number = 1
    ) {
        const decomposed = decomposeCameraMatrix(
            transformationMatrix,
            devicePixelRatio,
            this._viewPortWidth,
            this._viewPortHeight
        );

        // TODO clamp the attributes?
        this.setPosition(decomposed.position);
        this.setRotation(decomposed.rotation);
        this.setZoomLevel(decomposed.zoom);
    }

    /**
     * Sets the camera rotation with boundary validation and normalization.
     *
     * @param rotation - Target rotation in radians
     * @returns True if rotation was updated, false if outside boundaries or already at limit
     *
     * @remarks
     * Rotation is automatically normalized to 0-2π range. Returns false if:
     * - Rotation is outside configured boundaries
     * - Already at maximum boundary and trying to rotate beyond it
     * - Already at minimum boundary and trying to rotate below it
     *
     * @example
     * ```typescript
     * camera.setRotation(Math.PI / 4); // 45 degrees
     * camera.setRotation(Math.PI); // 180 degrees
     * ```
     */
    setRotation(rotation: number) {
        if (!rotationWithinLimits(rotation, this._rotationBoundaries)) {
            return false;
        }
        rotation = normalizeAngleZero2TwoPI(rotation);
        if (
            this._rotationBoundaries !== undefined &&
            this._rotationBoundaries.end !== undefined &&
            clampRotation(rotation, this._rotationBoundaries) ==
            this._rotationBoundaries.end &&
            this._rotation == this._rotationBoundaries.end
        ) {
            return false;
        }
        if (
            this._rotationBoundaries !== undefined &&
            this._rotationBoundaries.start !== undefined &&
            clampRotation(rotation, this._rotationBoundaries) ==
            this._rotationBoundaries.start &&
            this._rotation == this._rotationBoundaries.start
        ) {
            return false;
        }
        this._rotation = rotation;
        return true;
    }

    /**
     * Converts a point from viewport coordinates to world coordinates.
     *
     * @param point - Point in viewport space (relative to viewport center, in CSS pixels)
     * @returns Corresponding point in world coordinates
     *
     * @remarks
     * This accounts for camera position, zoom, and rotation. Useful for converting
     * mouse/touch input to world space.
     *
     * @example
     * ```typescript
     * // Convert mouse click to world position
     * const rect = canvas.getBoundingClientRect();
     * const viewportPoint = {
     *   x: event.clientX - rect.left - rect.width / 2,
     *   y: event.clientY - rect.top - rect.height / 2
     * };
     * const worldPoint = camera.convertFromViewPort2WorldSpace(viewportPoint);
     * ```
     */
    convertFromViewPort2WorldSpace(point: Point): Point {
        return convert2WorldSpaceAnchorAtCenter(
            point,
            this._position,
            this._zoomLevel,
            this._rotation
        );
    }

    /**
     * Converts a point from world coordinates to viewport coordinates.
     *
     * @param point - Point in world coordinates
     * @returns Corresponding point in viewport space (relative to viewport center, in CSS pixels)
     *
     * @remarks
     * This accounts for camera position, zoom, and rotation. Useful for positioning
     * UI elements at world object locations.
     *
     * @example
     * ```typescript
     * // Position a DOM element at a world object's location
     * const viewportPos = camera.convertFromWorld2ViewPort(objectWorldPos);
     * element.style.left = `${viewportPos.x + canvas.width / 2}px`;
     * element.style.top = `${viewportPos.y + canvas.height / 2}px`;
     * ```
     */
    convertFromWorld2ViewPort(point: Point): Point {
        return convert2ViewPortSpaceAnchorAtCenter(
            point,
            this._position,
            this._zoomLevel,
            this._rotation
        );
    }

    /**
     * Converts a point from world coordinates to viewport coordinates.
     * Alternative implementation of {@link convertFromWorld2ViewPort}.
     *
     * @param point - Point in world coordinates
     * @returns Corresponding point in viewport space (relative to viewport center, in CSS pixels)
     *
     * @remarks
     * This method provides an alternative calculation approach. In most cases,
     * prefer using {@link convertFromWorld2ViewPort} for consistency.
     */
    invertFromWorldSpace2ViewPort(point: Point): Point {
        let cameraFrameCenter = {
            x: this.viewPortWidth / 2,
            y: this._viewPortHeight / 2,
        };
        let delta2Point = PointCal.subVector(point, this._position);
        delta2Point = PointCal.rotatePoint(delta2Point, -this._rotation);
        delta2Point = PointCal.multiplyVectorByScalar(
            delta2Point,
            this._zoomLevel
        );
        return PointCal.addVector(cameraFrameCenter, delta2Point);
    }

    /**
     * Sets horizontal (x-axis) position boundaries for camera movement.
     *
     * @param min - Minimum x coordinate in world space
     * @param max - Maximum x coordinate in world space
     *
     * @remarks
     * If min > max, the values are automatically swapped. The current camera position
     * is not automatically clamped when boundaries are set.
     *
     * @example
     * ```typescript
     * camera.setHorizontalBoundaries(-1000, 1000);
     * // Camera can now only move between x: -1000 and x: 1000
     * ```
     */
    setHorizontalBoundaries(min: number, max: number) {
        if (min > max) {
            let temp = max;
            max = min;
            min = temp;
        }
        if (this._boundaries == undefined) {
            this._boundaries = {
                min: { x: undefined, y: undefined },
                max: { x: undefined, y: undefined },
            };
        }
        if (this._boundaries.min == undefined) {
            this._boundaries.min = { x: undefined, y: undefined };
        }
        if (this._boundaries.max == undefined) {
            this._boundaries.max = { x: undefined, y: undefined };
        }
        this._boundaries.min.x = min;
        this._boundaries.max.x = max;
        //NOTE leave for future optimization when setting the boundaries if the camera lies outside the boundaries clamp the position of the camera
        // if(!this.withinBoundaries(this.position)){
        //     this.position = this.clampPoint(this.position);
        // }
    }

    /**
     * Sets vertical (y-axis) position boundaries for camera movement.
     *
     * @param min - Minimum y coordinate in world space
     * @param max - Maximum y coordinate in world space
     *
     * @remarks
     * If min > max, the values are automatically swapped. The current camera position
     * is not automatically clamped when boundaries are set.
     *
     * @example
     * ```typescript
     * camera.setVerticalBoundaries(-500, 500);
     * // Camera can now only move between y: -500 and y: 500
     * ```
     */
    setVerticalBoundaries(min: number, max: number) {
        if (min > max) {
            let temp = max;
            max = min;
            min = temp;
        }
        if (this._boundaries == undefined) {
            this._boundaries = {
                min: { x: undefined, y: undefined },
                max: { x: undefined, y: undefined },
            };
        }
        if (this._boundaries.min == undefined) {
            this._boundaries.min = { x: undefined, y: undefined };
        }
        if (this._boundaries.max == undefined) {
            this._boundaries.max = { x: undefined, y: undefined };
        }
        this._boundaries.min.y = min;
        this._boundaries.max.y = max;
    }

    /**
     * Calculates the four corners of the viewport in world space, accounting for rotation.
     *
     * @param alignCoordinate - If true, uses standard y-up coordinate system. If false, inverts y-axis (default: true)
     * @returns Object containing the four corner points organized as top/bottom and left/right
     *
     * @remarks
     * Returns the actual rotated viewport corners. This is more precise than {@link viewPortAABB}
     * which returns the axis-aligned bounding box. Use this when you need the exact viewport bounds.
     *
     * @example
     * ```typescript
     * const corners = camera.viewPortInWorldSpace();
     * console.log(corners.top.left);    // Top-left corner in world coords
     * console.log(corners.top.right);   // Top-right corner
     * console.log(corners.bottom.left); // Bottom-left corner
     * console.log(corners.bottom.right);// Bottom-right corner
     * ```
     */
    viewPortInWorldSpace(alignCoordinate: boolean = true): {
        top: { left: Point; right: Point };
        bottom: { left: Point; right: Point };
    } {
        const topLeftCorner = convert2WorldSpaceAnchorAtCenter(
            {
                x: -this._viewPortWidth / 2,
                y: alignCoordinate
                    ? -this._viewPortHeight / 2
                    : this._viewPortHeight / 2,
            },
            this._position,
            this._zoomLevel,
            this._rotation
        );
        const topRightCorner = convert2WorldSpaceAnchorAtCenter(
            {
                x: this._viewPortWidth / 2,
                y: alignCoordinate
                    ? -this._viewPortHeight / 2
                    : this._viewPortHeight / 2,
            },
            this._position,
            this._zoomLevel,
            this._rotation
        );
        const bottomLeftCorner = convert2WorldSpaceAnchorAtCenter(
            {
                x: -this._viewPortWidth / 2,
                y: alignCoordinate
                    ? this._viewPortHeight / 2
                    : -this._viewPortHeight / 2,
            },
            this._position,
            this._zoomLevel,
            this._rotation
        );
        const bottomRightCorner = convert2WorldSpaceAnchorAtCenter(
            {
                x: this._viewPortWidth / 2,
                y: alignCoordinate
                    ? this._viewPortHeight / 2
                    : -this._viewPortHeight / 2,
            },
            this._position,
            this._zoomLevel,
            this._rotation
        );

        return {
            top: { left: topLeftCorner, right: topRightCorner },
            bottom: { left: bottomLeftCorner, right: bottomRightCorner },
        };
    }

    /**
     * Calculates the axis-aligned bounding box (AABB) of the viewport in world space.
     *
     * @param alignCoordinate - If true, uses standard y-up coordinate system. If false, inverts y-axis
     * @returns Object with min and max points defining the AABB
     *
     * @remarks
     * This returns the smallest axis-aligned rectangle that contains the entire viewport.
     * When the camera is rotated, this AABB will be larger than the actual viewport.
     * For exact viewport bounds, use {@link viewPortInWorldSpace}.
     *
     * Useful for:
     * - Frustum culling (checking if objects are visible)
     * - Broad-phase collision detection
     * - Determining which tiles/chunks to load
     *
     * @example
     * ```typescript
     * const aabb = camera.viewPortAABB();
     * const isVisible = (
     *   object.x >= aabb.min.x && object.x <= aabb.max.x &&
     *   object.y >= aabb.min.y && object.y <= aabb.max.y
     * );
     * ```
     */
    viewPortAABB(alignCoordinate?: boolean): { min: Point; max: Point } {
        const {
            top: { left: topLeft, right: topRight },
            bottom: { left: bottomLeft, right: bottomRight },
        } = this.viewPortInWorldSpace(alignCoordinate);

        return {
            min: {
                x: Math.min(topLeft.x, bottomLeft.x, topRight.x, bottomRight.x),
                y: Math.min(topLeft.y, bottomLeft.y, topRight.y, bottomRight.y),
            },
            max: {
                x: Math.max(topLeft.x, bottomLeft.x, topRight.x, bottomRight.x),
                y: Math.max(topLeft.y, bottomLeft.y, topRight.y, bottomRight.y),
            },
        };
    }
}
