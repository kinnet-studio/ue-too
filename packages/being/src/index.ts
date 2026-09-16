/**
 * @packageDocumentation
 * State machine library for TypeScript.
 *
 * @remarks
 * The `@ue-too/being` package provides a type-safe, flexible finite state machine implementation
 * for TypeScript. It enables you to model complex stateful behavior with clear state transitions,
 * event handling, and conditional logic through guards.
 *
 * ## Core Concepts
 *
 * - **States**: Discrete modes that your system can be in (e.g., IDLE, ACTIVE, LOADING)
 * - **Events**: Triggers that cause state transitions (e.g., "start", "stop", "load")
 * - **Context**: Shared data that persists across state transitions
 * - **Guards**: Conditional logic for dynamic state transitions
 * - **Event Reactions**: Handlers that define what happens when an event occurs in a state
 *
 * ## Key Features
 *
 * - **Type Safety**: Full TypeScript type inference for events, payloads, and states
 * - **Event Outputs**: Actions can return values accessible in event results
 * - **Lifecycle Hooks**: `uponEnter` and `beforeExit` callbacks for state transitions
 * - **Conditional Transitions**: Guards enable context-based routing to different states
 * - **Flexible Architecture**: States only define handlers for relevant events
 *
 * ## Main Exports
 *
 * - {@link TemplateStateMachine}: Concrete state machine implementation
 * - {@link TemplateState}: Abstract base class for creating states
 * - {@link BaseContext}: Context interface for shared state data
 * - {@link EventResult}: Type for event handling results
 * - {@link createStateGuard}: Utility for creating type guards
 *
 * @example
 * Basic state machine
 * ```typescript
 * import { TemplateStateMachine, TemplateState, BaseContext } from '@ue-too/being';
 *
 * // Define events and payloads
 * type Events = {
 *   start: {};
 *   stop: {};
 *   tick: { delta: number };
 * };
 *
 * // Define states
 * type States = "IDLE" | "RUNNING" | "PAUSED";
 *
 * // Define context
 * interface TimerContext extends BaseContext {
 *   elapsed: number;
 *   setup() { this.elapsed = 0; }
 *   cleanup() {}
 * }
 *
 * // Create state classes
 * class IdleState extends TemplateState<Events, TimerContext, States> {
 *   eventReactions = {
 *     start: {
 *       action: (context) => {
 *         console.log('Starting timer');
 *         context.elapsed = 0;
 *       },
 *       defaultTargetState: "RUNNING"
 *     }
 *   };
 * }
 *
 * class RunningState extends TemplateState<Events, TimerContext, States> {
 *   eventReactions = {
 *     tick: {
 *       action: (context, event) => {
 *         context.elapsed += event.delta;
 *       }
 *     },
 *     stop: {
 *       action: (context) => {
 *         console.log('Stopped at:', context.elapsed);
 *       },
 *       defaultTargetState: "IDLE"
 *     }
 *   };
 * }
 *
 * // Create and use the state machine
 * const context: TimerContext = {
 *   elapsed: 0,
 *   setup() { this.elapsed = 0; },
 *   cleanup() {}
 * };
 *
 * const timer = new TemplateStateMachine<Events, TimerContext, States>(
 *   {
 *     IDLE: new IdleState(),
 *     RUNNING: new RunningState(),
 *     PAUSED: new PausedState()
 *   },
 *   "IDLE",
 *   context
 * );
 *
 * // Trigger events
 * timer.happens("start");
 * timer.happens("tick", { delta: 16 });
 * timer.happens("stop");
 * ```
 *
 * @see {@link TemplateStateMachine} for the main state machine class
 * @see {@link TemplateState} for creating state implementations
 */

export * from './interface';
export * from './introspect';
export * from './vending-machine-example';
export * from './schema-factory';
export * from './delegating-state';
export * from './expansion';
