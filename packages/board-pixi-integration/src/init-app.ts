import {
    BoardCamera,
    CameraRig,
    DefaultBoardCamera,
    InputOrchestrator,
    ObservableBoardCamera,
    StateMachine,
    TouchEventParser,
    TouchInputTracker,
    VanillaTouchEventParser,
    createDefaultCameraMux,
    createDefaultCameraRig,
    createDefaultPanByHandler,
    createTouchInputStateMachine,
    minZoomLevelBaseOnDimensions,
    zoomLevelBoundariesShouldUpdate,
} from '@ue-too/board';
import { RawUserInputPublisher } from '@ue-too/board';
import {
    CanvasProxy,
    ObservableInputTracker,
    createKmtInputStateMachine,
} from '@ue-too/board';
import {
    VanillaKMTEventParser,
    createCameraMuxWithAnimationAndLock,
} from '@ue-too/board';
import { Application, Matrix } from 'pixi.js';
import { attachBaseTeardown } from './base-teardown';

export interface BaseAppComponents {
    app: Application;
    camera: DefaultBoardCamera;
    canvasProxy: CanvasProxy;
    cameraRig: CameraRig;
    inputOrchestrator: InputOrchestrator;
    observableInputTracker: ObservableInputTracker;
    kmtInputStateMachine: StateMachine;
    kmtParser: VanillaKMTEventParser;
    touchParser: TouchEventParser;
    /** The base teardown (parsers + canvas proxy). Also registered as the
     *  first entry of `cleanups`; prefer extending via `cleanups.push(…)`
     *  over replacing this property. */
    cleanup: () => void;
    /** Teardown extension point: run in order by the React integration on
     *  unmount, before the Pixi app is destroyed. Push app-level teardown
     *  (window listeners, preference subscriptions, swapped-in parsers) here. */
    cleanups: (() => void)[];
}

export type InitAppOptions = {
    fullScreen: boolean;
    limitEntireViewPort: boolean;
    camera: DefaultBoardCamera;
    boundaries: { min: { x: number; y: number }; max: { x: number; y: number } };
};

export const baseInitApp = async (
    canvasElement: HTMLCanvasElement,
    option: Partial<InitAppOptions>
): Promise<BaseAppComponents> => {

    const {
        boundaries = { min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } },
        fullScreen = true,
        limitEntireViewPort = true,
        camera = new DefaultBoardCamera({
            viewPortWidth: canvasElement.width,
            viewPortHeight: canvasElement.height,
            position: { x: 0, y: 0 },
            rotation: 0,
            zoomLevel: 1,
            boundaries,
        })
    } = option;

    // Create a PixiJS application.
    const app = new Application();

    const cleanups: (() => void)[] = [];

    const canvasProxy = new CanvasProxy(canvasElement);
    const cameraRig = createDefaultCameraRig(camera);
    const cameraMux = createDefaultCameraMux();
    const inputOrchestrator = new InputOrchestrator(
        cameraMux,
        cameraRig,
        new RawUserInputPublisher()
    );
    const observableInputTracker = new ObservableInputTracker(canvasProxy);
    const touchInputTracker = new TouchInputTracker(canvasProxy);

    const touchInputStateMachine =
        createTouchInputStateMachine(touchInputTracker);

    // Intialize the application.
    await app.init({
        preference: 'webgpu',
        resolution: devicePixelRatio,
        autoDensity: true,
        canvas: canvasElement,
        antialias: true,
        backgroundAlpha: 0,
        resizeTo: fullScreen ? window : undefined,
    });

    camera.viewPortHeight = app.renderer.height;
    camera.viewPortWidth = app.renderer.width;

    if (limitEntireViewPort) {
        const targetMinZoomLevel = minZoomLevelBaseOnDimensions(
            camera.boundaries,
            app.renderer.width,
            app.renderer.height,
            camera.rotation
        );
        if (
            targetMinZoomLevel != undefined &&
            zoomLevelBoundariesShouldUpdate(
                camera.zoomBoundaries,
                targetMinZoomLevel
            )
        ) {
            camera.setMinZoomLevel(targetMinZoomLevel);
        }
    }

    // Listen for canvas resize events
    app.renderer.on('resize', (width: number, height: number) => {
        camera.viewPortWidth = width;
        camera.viewPortHeight = height;
        if (limitEntireViewPort) {
            const targetMinZoomLevel = minZoomLevelBaseOnDimensions(
                camera.boundaries,
                width,
                height,
                camera.rotation
            );
            if (
                targetMinZoomLevel != undefined &&
                zoomLevelBoundariesShouldUpdate(
                    camera.zoomBoundaries,
                    targetMinZoomLevel
                )
            ) {
                camera.setMinZoomLevel(targetMinZoomLevel);
            }
        }
    });

    const kmtInputStateMachine = createKmtInputStateMachine(
        observableInputTracker
    );

    const kmtParser = new VanillaKMTEventParser(
        kmtInputStateMachine,
        inputOrchestrator,
        app.canvas
    );
    kmtParser.setUp();

    const touchParser = new VanillaTouchEventParser(
        touchInputStateMachine,
        inputOrchestrator,
        app.canvas
    );
    touchParser.setUp();

    const transform = camera.getTransform(1);
    if (
        transform.a !== app.stage.localTransform.a ||
        transform.b !== app.stage.localTransform.b ||
        transform.c !== app.stage.localTransform.c ||
        transform.d !== app.stage.localTransform.d ||
        transform.e !== app.stage.localTransform.tx ||
        transform.f !== app.stage.localTransform.ty
    ) {
        app.stage.setFromMatrix(
            new Matrix(
                transform.a,
                transform.b,
                transform.c,
                transform.d,
                transform.e,
                transform.f
            )
        );
    }

    // Add an animation loop callback to the application's ticker.
    app.ticker.add(time => {
        const transform = camera.getTransform(1);
        if (
            transform.a !== app.stage.localTransform.a ||
            transform.b !== app.stage.localTransform.b ||
            transform.c !== app.stage.localTransform.c ||
            transform.d !== app.stage.localTransform.d ||
            transform.e !== app.stage.localTransform.tx ||
            transform.f !== app.stage.localTransform.ty
        ) {
            app.stage.setFromMatrix(
                new Matrix(
                    transform.a,
                    transform.b,
                    transform.c,
                    transform.d,
                    transform.e,
                    transform.f
                )
            );
        }
    });

    // The base teardown reads the LIVE parsers off the returned object at
    // teardown time (apps assign extended parsers onto it after init) and is
    // registered in `cleanups`, so the React integration runs it even when an
    // app replaces `cleanup` by spreading these components into its own
    // object. See base-teardown.ts.
    return attachBaseTeardown({
        app,
        camera,
        canvasProxy,
        cameraRig,
        inputOrchestrator,
        observableInputTracker,
        kmtInputStateMachine,
        kmtParser,
        touchParser,
        cleanups,
    });
};
