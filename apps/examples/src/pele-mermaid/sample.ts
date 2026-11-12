/**
 * The starting diagram: the board package's own input-to-camera data flow,
 * copied from `packages/board/README.md`.
 */
export const SAMPLE_DIAGRAM = `flowchart TB
    subgraph Input ["Input Layer"]
        CE["🖼️ Canvas Element"]
        CDP["📐 Canvas Proxy"]
        CEP["🎯 Event Parsers<br/><small>KMT + Touch</small>"]
    end

    subgraph Interpretation ["Input Interpretation"]
        ISM["🔄 Input State Machine<br/><small>interprets user intent</small>"]
        IT["📋 Input Tracker<br/><small>cursor position, canvas info</small>"]
    end

    subgraph Orchestration ["Input Orchestration"]
        IO["🎛️ Input Orchestrator<br/><small>central routing hub</small>"]
    end

    subgraph Publishing ["Raw Input Publishing"]
        RIP["📡 Raw Input Publisher"]
        RIO["👂 User Callbacks<br/><small>onInput handlers</small>"]
    end

    subgraph CameraControl ["Camera Control"]
        CM["🚦 Camera Mux<br/><small>permission control</small>"]
        OCIS["🎬 Other Input Sources<br/><small>animations, programmatic</small>"]
        CR["🎮 Camera Rig<br/><small>restrictions & clamping</small>"]
    end

    subgraph Camera ["Camera"]
        OC["📷 Observable Camera"]
        ACMO["👂 Camera Observers<br/><small>on handlers</small>"]
    end

    %% Canvas setup
    CDP -.->|"tracks dimensions"| CE
    CE -->|"DOM events"| CEP
    CDP -->|"canvas info"| IT

    %% Input interpretation
    CEP -->|"state machine events"| ISM
    ISM <-->|"read/update context"| IT
    ISM -->|"pan, zoom, rotate"| IO

    %% Orchestrator routing (parallel paths)
    IO -->|"always publish"| RIP
    RIP --> RIO
    IO -->|"ask permission"| CM

    %% Camera Mux
    OCIS -->|"request input"| CM
    CM -->|"allowPassThrough?"| IO

    %% Camera execution
    IO -->|"if allowed"| CR
    CR --> OC
    OC --> ACMO`;
