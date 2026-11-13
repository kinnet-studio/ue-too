/**
 * Input state machine module exports.
 *
 * @remarks
 * This module provides state machines for interpreting raw input events into high-level gestures.
 * Separate state machines handle keyboard/mouse/trackpad (KMT) and touch input.
 *
 * ## Components
 *
 * - **KMT State Machine**: {@link createKmtInputStateMachine} for keyboard/mouse/trackpad gestures
 * - **Touch State Machine**: {@link createTouchInputStateMachine} for two-finger touch gestures (pan, pinch)
 * - **One-Finger-Pan Touch State Machine**: {@link createOneFingerPanTouchInputStateMachine}, an opt-in
 *   alternative where one finger pans and two fingers pinch-zoom
 * - **Input Contexts**: {@link ObservableInputTracker}, {@link TouchInputTracker} for tracking input state
 *
 * @see {@link createKmtInputStateMachine} for KMT gesture recognition
 * @see {@link createTouchInputStateMachine} for touch gesture recognition
 *
 * @module
 */

export * from './kmt-input-context';
export * from './touch-input-context';
export * from './touch-input-state-machine';
export * from './one-finger-pan-touch-input-state-machine';
export * from './kmt-input-state-machine';
