import {
    DefaultBoardCamera,
    EdgeAutoCameraInput,
    InputOrchestrator,
    createDefaultCameraRig,
} from '@ue-too/board';
import { VanillaKMTEventParser } from '@ue-too/board';
import { RawUserInputPublisher } from '@ue-too/board';
import {
    CanvasProxy,
    ObservableInputTracker,
    createKmtInputStateMachine,
} from '@ue-too/board';
import { createCameraMuxWithAnimationAndLock } from '@ue-too/board';
import { PixiInputParser } from '@ue-too/board-pixi-integration';
import {
    Application,
    Assets,
    Graphics,
    Matrix,
    PixiTouch,
    Sprite,
} from 'pixi.js';

import { followInputMode } from '../input-mode';

// Asynchronous IIFE
(async () => {
    // Create a PixiJS application.
    const app = new Application();

    const canvas = document.querySelector('#graph') as HTMLCanvasElement;

    // Intialize the application.
    await app.init({
        background: '#1099bb',
        resolution: devicePixelRatio,
        autoDensity: true,
        canvas: canvas,
        antialias: true,
    });

    const camera = new DefaultBoardCamera({
        viewPortWidth: app.screen.width,
        viewPortHeight: app.screen.height,
        position: { x: 100, y: 100 },
        rotation: 0,
        zoomLevel: 2,
    });
    const canvasProxy = new CanvasProxy(app.canvas);
    const cameraRig = createDefaultCameraRig(camera);
    const inputOrchestrator = new InputOrchestrator(
        createCameraMuxWithAnimationAndLock(),
        cameraRig,
        new RawUserInputPublisher()
    );
    const observableInputTracker = new ObservableInputTracker(canvasProxy);
    followInputMode(mode => observableInputTracker.setMode(mode));
    const kmtInputStateMachine = createKmtInputStateMachine(
        observableInputTracker
    );
    console.log('kmt input state machine', kmtInputStateMachine);

    // Listen for canvas resize events
    app.renderer.on('resize', (width: number, height: number) => {
        console.log('Canvas resized to:', width, height);
        camera.viewPortWidth = width;
        camera.viewPortHeight = height;
    });

    camera.setRotation(Math.PI / 4);

    const pixiInputParser = new PixiInputParser(
        app,
        kmtInputStateMachine,
        inputOrchestrator,
        camera
    );
    pixiInputParser.setUp();
    pixiInputParser.showHitAreaDebug();

    // Load the bunny texture.
    const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
    // Create a new Sprite from an image path.
    const bunny = new Sprite(texture);

    // app.stage.setFromMatrix(new Matrix(1, 0, 0, 1, app.screen.width / 2, app.screen.height / 2));

    // Add to stage.
    // console.log(camera.contextTransform);
    const transform = camera.getTransform(1);
    if (
        transform.a === app.stage.localTransform.a &&
        transform.b === app.stage.localTransform.b &&
        transform.c === app.stage.localTransform.c &&
        transform.d === app.stage.localTransform.d &&
        transform.e === app.stage.localTransform.tx &&
        transform.f === app.stage.localTransform.ty
    ) {
    } else {
        console.log('setting stage transform');
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
    app.stage.addChild(bunny);
    app.stage.addChild(
        new Graphics()
            .arc(0, 0, 100, 0, Math.PI * 2)
            .fill({ color: 0x000000, alpha: 0.5 })
    );

    // Center the sprite's anchor point.
    bunny.anchor.set(0.5);

    // Move the sprite to the center of the screen.
    bunny.x = 100;
    bunny.y = 100;

    // Add an animation loop callback to the application's ticker.
    app.ticker.add(time => {
        pixiInputParser.updateHitArea();
        const transform = camera.getTransform(1, true);
        if (
            transform.a === app.stage.localTransform.a &&
            transform.b === app.stage.localTransform.b &&
            transform.c === app.stage.localTransform.c &&
            transform.d === app.stage.localTransform.d &&
            transform.e === app.stage.localTransform.tx &&
            transform.f === app.stage.localTransform.ty
        ) {
        } else {
            console.log('setting stage transform');
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
})();
