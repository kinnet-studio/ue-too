const en = {
    // Index page
    'index.title': 'uē-tôo Examples',
    'index.subtitle': 'Interactive examples and demos',
    'index.description': 'Explore different features and integrations below.',

    // Nav links
    'nav.base': 'Base',
    'nav.attach-detach': 'Attach / Detach',
    'nav.ruler': 'Ruler',
    'nav.navigation': 'Navigation',
    'nav.pixi': 'Pixi Integration',
    'nav.konva': 'Konva Integration',
    'nav.fabric': 'Fabric Integration',
    'nav.camera-animation': 'Camera Animation',
    'nav.image': 'Image Example',
    'nav.svg': 'SVG Example',
    'nav.pele-mermaid': 'Mermaid (Pele)',
    'nav.state-machine': 'State Machine Visualizer',

    // Card titles & descriptions
    'card.base.title': 'Base Example',
    'card.base.desc':
        'Basic canvas with pan, zoom, and rotate functionality. A simple starting point to understand the core features.',
    'card.attach-detach.title': 'Attach / Detach Example',
    'card.attach-detach.desc':
        'Demonstrates how to dynamically attach and detach a canvas from the board at runtime.',
    'card.ruler.title': 'Ruler Example',
    'card.ruler.desc':
        'Ruler overlay with measurement tools. Demonstrates how to add measurement and grid overlays.',
    'card.navigation.title': 'Navigation Example',
    'card.navigation.desc':
        'Advanced navigation controls. Shows more sophisticated camera and input handling.',
    'card.pixi.title': 'Pixi Integration',
    'card.pixi.desc':
        'Integration with PixiJS. Demonstrates how to use uē-tôo with PixiJS for high-performance graphics.',
    'card.konva.title': 'Konva Integration',
    'card.konva.desc':
        'Integration with Konva.js. Shows how to integrate uē-tôo with Konva.js for canvas-based graphics.',
    'card.fabric.title': 'Fabric Integration',
    'card.fabric.desc':
        'Integration with Fabric.js. Demonstrates uē-tôo integration with Fabric.js for interactive canvas objects.',
    'card.camera-animation.title': 'Camera Animation',
    'card.camera-animation.desc':
        'Smooth camera flights along a zoom-and-pan path. Click to fly somewhere nearby, or wander off and press Back to start to watch the camera zoom out, glide home, and zoom back in.',
    'card.svg.title': 'SVG Example',
    'card.svg.desc': 'SVG examples. Demonstrates how to work with SVG in uē-tôo.',
    'card.pele-mermaid.title': 'Mermaid (Pele)',
    'card.pele-mermaid.desc':
        'Editable Mermaid diagrams rendered by Pele, panned and zoomed with the uē-tôo camera.',
    'card.state-machine.title': 'State Machine Visualizer',
    'card.state-machine.desc':
        'Interactive statechart visualizer and simulator for @ue-too/being machines, rendered with @ue-too/board.',
    'card.image.title': 'Image Example',
    'card.image.desc':
        'Image manipulation examples. Demonstrates how to work with images in uē-tôo.',
    'card.physics.title': 'Physics Example',
    'card.physics.desc':
        'Physics examples. Demonstrates how to work with physics in uē-tôo.',
    'card.view': 'View Example',

    // Shared control instructions (HTML)
    'controls.scroll-zoom':
        '<kbd>Scroll</kbd> to zoom in and out',
    'controls.scroll-zoom-short':
        '<kbd>Scroll</kbd> to zoom',
    'controls.scroll-zoom-image':
        '<kbd>Scroll</kbd> to zoom in on the image',
    'controls.scroll-zoom-ruler':
        '<kbd>Scroll</kbd> to zoom — watch the ruler scale adapt',
    'controls.pan':
        '<kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan',
    'controls.pan-viewport':
        '<kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan the viewport',
    'controls.pan-around':
        '<kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan around',
    'controls.pan-manual':
        '<kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan manually',
    'controls.pan-ruler':
        '<kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan — the ruler numbers shift to reflect the visible region',
    'controls.pan-builtin':
        '<kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan (built-in)',
    'controls.scroll-and-pan':
        '<kbd>Scroll</kbd> to zoom, <kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan',
    'controls.trackpad':
        '<strong>Trackpad:</strong> <kbd>Two-finger drag</kbd> to pan, <kbd>Pinch</kbd> to zoom',
    'controls.touch':
        '<strong>Touch:</strong> <kbd>Two-finger drag</kbd> to pan, <kbd>Pinch</kbd> to zoom',

    // Base example
    'base.title': 'Base Example',
    'base.desc':
        'The simplest setup: a Board attached to a canvas with built-in pan, zoom, and rotate.',
    'base.click-log':
        '<kbd>Click</kbd> on the canvas to log the world coordinates to the console',

    // Attach/Detach example
    'attach-detach.title': 'Attach / Detach Example',
    'attach-detach.desc':
        'Demonstrates the Board lifecycle: dynamically attaching and detaching a canvas at runtime. The board starts detached — nothing renders until you attach it.',
    'attach-detach.attach': 'Attach',
    'attach-detach.detach': 'Detach',
    'attach-detach.attach-instruction':
        'Click <strong>Attach</strong> to connect the board to the canvas and start rendering',
    'attach-detach.detach-instruction':
        'Click <strong>Detach</strong> to disconnect — the canvas goes blank and input stops',
    'attach-detach.reattach': 'Re-attach at any time to resume',

    // Ruler example
    'ruler.title': 'Ruler Example',
    'ruler.desc':
        'Displays a measurement ruler overlay along the edges of the canvas. The ruler ticks update dynamically as you pan and zoom, showing world-space coordinates.',

    // Navigation example
    'navigation.title': 'Navigation Example',
    'navigation.desc':
        'Shows how to programmatically pan the camera using keyboard input via <code>panByViewPort()</code>.',
    'navigation.wasd':
        '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to pan up, left, down, right',
    'navigation.scroll-and-pan':
        '<kbd>Scroll</kbd> to zoom and <kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan (built-in)',

    // Camera Animation example
    'camera-animation.title': 'Camera Animation',
    'camera-animation.desc':
        'Smooth camera flights with <code>createZoomPanPath</code> from <code>@ue-too/board</code>, driven by <code>@ue-too/animate</code>. On a long trip the camera zooms out, glides across, and zooms back in.',
    'camera-animation.click':
        '<kbd>Click</kbd> anywhere to fly the camera there',
    'camera-animation.back':
        '<strong>Back to start</strong> flies the camera back to where it began, marked with an orange cross',
    'camera-animation.interrupt':
        'Pan or zoom during a flight to take over the camera',
    'camera-animation.back-button': 'Back to start',
    'camera-animation.ruler': 'A ruler overlay shows the current viewport boundaries',

    // Image example
    'image.title': 'Image Example',
    'image.desc':
        'Upload an image to draw it on the pannable and zoomable canvas. Colored axis arrows (red = Y, green = X) at the origin show the world coordinate directions.',
    'image.choose': 'Choose Image',
    'image.upload':
        'Click <strong>Choose Image</strong> to upload a file',

    // SVG example
    'svg.title': 'SVG Example',
    'svg.desc':
        'Uses the board camera system with an SVG element instead of a canvas. The camera transform (translate, scale, rotate) is applied to an SVG <code>&lt;g&gt;</code> group.',
    'svg.inputs': 'Use the inputs below to set camera position, rotation, and zoom',
    'svg.click-log':
        '<kbd>Click</kbd> to log viewport and world coordinates to the console',
    'svg.rotation': 'Rotation',
    'svg.zoom': 'Zoom',
    'svg.apply': 'Apply',

    // Pele Mermaid example
    'pele-mermaid.title': 'Mermaid with Pele',
    'pele-mermaid.desc':
        'Pele renders Mermaid to SVG; the board camera transforms an SVG group around it, so the diagram stays sharp at any zoom.',
    'pele-mermaid.editor-label': 'Mermaid source',
    'pele-mermaid.fit': 'Fit',

    // Pixi example
    'pixi.title': 'PixiJS Integration',
    'pixi.desc':
        'Full-screen PixiJS canvas with uē-tôo camera controls. A bunny sprite and a circle are rendered using PixiJS while the board camera handles viewport transforms.',
    'pixi.camera-info':
        'Camera starts at position (100, 100) with 2x zoom and 45-degree rotation',

    // Konva example
    'konva.title': 'Konva Integration',
    'konva.desc':
        'Integrates uē-tôo camera controls with Konva.js. A red circle is drawn using Konva, while the board camera applies translation, rotation, and scale transforms to the Konva stage each frame.',
    'konva.sync':
        'The Konva stage transform is synchronized with the camera every frame',

    // Fabric example
    'fabric.title': 'Fabric.js Integration',
    'fabric.desc':
        'Integrates uē-tôo camera controls with Fabric.js. Toggle between movement mode (pan/zoom the viewport) and selection mode (select and manipulate Fabric objects).',
    'fabric.movement':
        'In <strong>Movement mode</strong>: <kbd>Scroll</kbd> to zoom, <kbd>Middle Mouse Drag</kbd> or <kbd>Space + Left Drag</kbd> to pan',
    'fabric.selection':
        'In <strong>Selection mode</strong>: click to select Fabric objects ("Hello world!" text and rectangle)',
    'fabric.toggle': 'Click the button below to switch modes',
    'fabric.toggle-button': 'Toggle Movement Mode',

    // Physics example
    'physics.title': 'Physics Example',
    'physics.desc':
        'A mechanical four-bar linkage simulated with rigid body physics and pin joint constraints. Two actuating links are pinned at fixed points and connected through a triangular link.',
    'physics.arrows':
        '<kbd>Arrow keys</kbd> to apply forces to the left link',
    'physics.qe':
        '<kbd>Q</kbd> / <kbd>E</kbd> to rotate the left link',
} as const;

export default en;
