import {
    BaseContext,
    DefaultOutputMapping,
    Defer,
    EventResult,
    StateMachine,
    TemplateState,
} from './interface';

/**
 * The part of a state machine a {@link DelegatingState} drives.
 *
 * @remarks
 * Structural on purpose: `StateMachine<any, any, any, any>` is not a supertype
 * of a concrete machine because the `State` type is invariant in its generics,
 * so the host is typed against just the members it calls. Every
 * `TemplateStateMachine` satisfies it.
 *
 * @category Composition
 */
export type HostableStateMachine = {
    readonly currentState: string;
    happens: (...args: any[]) => EventResult<any, any>;
    start(): void;
    reset(): void;
    wrapup(): void;
};

/**
 * A state that hosts a complete child state machine and forwards events to it.
 *
 * @remarks
 * This is the composition primitive for nesting one machine inside another.
 * While the parent machine is in a `DelegatingState`, every event is offered
 * to the child first. When the child handles it, the child's output is returned
 * and the parent stays in this state; the child's own `nextState` is deliberately
 * dropped because it names a *child* state, not a parent one. When the child does
 * not handle the event, the state's own `_eventReactions` get their turn, which is
 * how a subclass declares its exits.
 *
 * Lifecycle is tied to the parent state: entering starts (or restarts) the child
 * from its initial state, leaving calls `wrapup()` on it. Subclasses that override
 * `uponEnter` or `beforeExit` must call `super`.
 *
 * @typeParam EventPayloadMapping - The parent machine's event mapping
 * @typeParam Context - The parent machine's context
 * @typeParam States - The parent machine's state union
 * @typeParam Child - The child machine type, exposed through {@link DelegatingState.child}
 * @typeParam EventOutputMapping - The parent machine's output mapping
 *
 * @category Composition
 *
 * @example
 * ```typescript
 * class MoveState extends DelegatingState<AppEvents, BaseContext, AppStates, KmtInputStateMachine> {
 *     constructor(context: KmtInputContext) {
 *         super(createKmtInputStateMachine(context));
 *     }
 *     protected _eventReactions = {
 *         switchToApp: { action: NO_OP, defaultTargetState: 'IDLE' },
 *     };
 * }
 * ```
 */
export abstract class DelegatingState<
    EventPayloadMapping,
    Context extends BaseContext,
    States extends string,
    Child extends HostableStateMachine,
    EventOutputMapping extends Partial<
        Record<keyof EventPayloadMapping, unknown>
    > = DefaultOutputMapping<EventPayloadMapping>,
> extends TemplateState<
    EventPayloadMapping,
    Context,
    States,
    EventOutputMapping
> {
    private readonly _child: Child;

    constructor(child: Child) {
        super();
        this._child = child;
    }

    /** The hosted child machine, for introspection and tests. */
    get child(): Child {
        return this._child;
    }

    protected _defer: Defer<
        Context,
        EventPayloadMapping,
        States,
        EventOutputMapping
    > = {
        action: (_context, event, eventKey) => {
            const result: EventResult<string, unknown> = this._child.happens(
                eventKey as string,
                event
            );
            if (!result.handled) {
                return { handled: false };
            }
            if ('output' in result && result.output !== undefined) {
                return { handled: true, output: result.output };
            }
            return { handled: true };
        },
    };

    uponEnter(
        _context: Context,
        _stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >,
        _from: States | 'INITIAL'
    ): void {
        if (this._child.currentState === 'INITIAL') {
            this._child.start();
        } else {
            this._child.reset();
        }
    }

    beforeExit(
        _context: Context,
        _stateMachine: StateMachine<
            EventPayloadMapping,
            Context,
            States,
            EventOutputMapping
        >,
        _to: States | 'TERMINAL'
    ): void {
        this._child.wrapup();
    }
}
