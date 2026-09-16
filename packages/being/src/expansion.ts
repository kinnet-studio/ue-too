import {
    BaseContext,
    DefaultOutputMapping,
    EventGuards,
    EventReactions,
    Guard,
    State,
    StateMachine,
    TemplateState,
} from './interface';

/**
 * Resolves to `State<E2, C2, S2, O2>` when the target generics are a superset of
 * the original's, and to a descriptive error object otherwise so the mistake
 * surfaces where the widened state is registered.
 *
 * @category Composition
 */
export type WidenedState<E1, C1, S1, O1, E2, C2, S2, O2> = [E2] extends [E1]
    ? [C2] extends [C1]
        ? [S1] extends [S2]
            ? [O2] extends [O1]
                ? State<
                      E2,
                      C2 & BaseContext,
                      S2 & string,
                      O2 & Partial<Record<keyof E2, unknown>>
                  >
                : { error: 'widened output mapping must extend the original' }
            : { error: 'widened states must include every original state' }
        : { error: 'widened context must extend the original context' }
    : { error: 'widened events must extend the original events' };

/**
 * Creates a function that retypes a state for a machine with a superset of its
 * events, states, context and outputs.
 *
 * @remarks
 * At runtime a state only ever consults its own reactions, so an original state
 * behaves correctly inside a wider machine: events it does not list come back
 * `handled: false`. The `State` type is invariant in its generics, though, so the
 * compiler rejects the registration. This helper is that cast, guarded so that a
 * target which *narrows* the original produces a type error instead of a lie.
 *
 * Name the target generics once, then widen as many original states as needed.
 *
 * @category Composition
 *
 * @example
 * ```typescript
 * const widen = createStateWidener<ExpEvents, ExpContext, ExpStates, ExpOut>();
 * const states = { PAN: widen(new PanState()), IDLE: widen(new KmtIdleState()) };
 * ```
 */
export function createStateWidener<
    E2,
    C2 extends BaseContext,
    S2 extends string,
    O2 extends Partial<Record<keyof E2, unknown>> = DefaultOutputMapping<E2>,
>() {
    return <
        E1,
        C1 extends BaseContext,
        S1 extends string,
        O1 extends Partial<Record<keyof E1, unknown>>,
    >(
        state: State<E1, C1, S1, O1>
    ): WidenedState<E1, C1, S1, O1, E2, C2, S2, O2> =>
        state as unknown as WidenedState<E1, C1, S1, O1, E2, C2, S2, O2>;
}

/**
 * The part of a state {@link extendState} reads from the original.
 *
 * @remarks
 * Structural for the same reason as `HostableStateMachine`: a concrete state is
 * not assignable to `State<any, any, any, any>`. Every `State` satisfies it.
 *
 * @category Composition
 */
export type ExtendableState = {
    readonly eventReactions: object;
    readonly guards: object;
    readonly eventGuards: object;
    readonly eventPreconditions?: object;
    readonly delay: unknown;
    uponEnter: (...args: any[]) => void;
    beforeExit: (...args: any[]) => void;
};

/**
 * What {@link extendState} may add to or wrap on an existing state.
 *
 * @category Composition
 */
export type StateExtension<
    E,
    C extends BaseContext,
    S extends string,
    O extends Partial<Record<keyof E, unknown>>,
> = {
    /**
     * Reactions to add or override. Pass an object to merge over the inherited
     * reactions, or a function that receives the inherited reactions so an
     * override can wrap the original action.
     */
    eventReactions?:
        | Partial<EventReactions<E, C, S, O>>
        | ((
              inherited: EventReactions<E, C, S, O>
          ) => Partial<EventReactions<E, C, S, O>>);
    /** Guards to add; merged over the inherited guards. */
    guards?: Guard<C>;
    /** Event guards to add; merged over the inherited event guards. */
    eventGuards?: Partial<EventGuards<E, S, C, Guard<C>>>;
    /** Wraps the inherited `uponEnter`; call `inherited()` to run the original. */
    uponEnter?: (
        context: C,
        stateMachine: StateMachine<E, C, S, O>,
        from: S | 'INITIAL',
        inherited: () => void
    ) => void;
    /** Wraps the inherited `beforeExit`; call `inherited()` to run the original. */
    beforeExit?: (
        context: C,
        stateMachine: StateMachine<E, C, S, O>,
        to: S | 'TERMINAL',
        inherited: () => void
    ) => void;
};

class ExtendedState<
    E,
    C extends BaseContext,
    S extends string,
    O extends Partial<Record<keyof E, unknown>>,
> extends TemplateState<E, C, S, O> {
    constructor(
        private readonly _original: ExtendableState,
        private readonly _extension: StateExtension<E, C, S, O>
    ) {
        super();
        const inherited = _original.eventReactions as unknown as EventReactions<
            E,
            C,
            S,
            O
        >;
        const added =
            typeof _extension.eventReactions === 'function'
                ? _extension.eventReactions(inherited)
                : (_extension.eventReactions ?? {});
        this._eventReactions = { ...inherited, ...added } as EventReactions<
            E,
            C,
            S,
            O
        >;
        this._guards = {
            ..._original.guards,
            ..._extension.guards,
        } as Guard<C>;
        this._eventGuards = {
            ..._original.eventGuards,
            ..._extension.eventGuards,
        } as Partial<EventGuards<E, S, C, Guard<C>>>;
        this._eventPreconditions = (_original.eventPreconditions ??
            {}) as typeof this._eventPreconditions;
        this._delay = _original.delay as typeof this._delay;
    }

    uponEnter(
        context: C,
        stateMachine: StateMachine<E, C, S, O>,
        from: S | 'INITIAL'
    ): void {
        const inherited = () =>
            this._original.uponEnter(context, stateMachine, from);
        if (this._extension.uponEnter) {
            this._extension.uponEnter(context, stateMachine, from, inherited);
        } else {
            inherited();
        }
    }

    beforeExit(
        context: C,
        stateMachine: StateMachine<E, C, S, O>,
        to: S | 'TERMINAL'
    ): void {
        const inherited = () =>
            this._original.beforeExit(context, stateMachine, to);
        if (this._extension.beforeExit) {
            this._extension.beforeExit(context, stateMachine, to, inherited);
        } else {
            inherited();
        }
    }
}

/**
 * Builds a state for a wider machine out of an existing state plus additions.
 *
 * @remarks
 * Everything the original exposes through the `State` interface is inherited:
 * reactions, guards, event guards, preconditions, delay and the enter/exit hooks.
 * The extension merges over that, so an entry with the same event name replaces
 * the inherited one. Use the function form of `eventReactions` when an override
 * needs to call the inherited action. A `_defer` on the original is not carried
 * over because the `State` interface does not expose it.
 *
 * The target generics are usually inferred from the registration site; name them
 * explicitly when they are not.
 *
 * @category Composition
 *
 * @example
 * ```typescript
 * const idle = extendState<ExpEvents, ExpContext, ExpStates, ExpOut>(new KmtIdleState(), {
 *     eventReactions: inherited => ({
 *         scroll: scaleZoom(inherited.scroll),
 *         leftPointerDown: { action: startPlacement, defaultTargetState: 'PLACEMENT' },
 *     }),
 *     uponEnter: (context, _m, _from, inherited) => {
 *         inherited();
 *         context.reapplyHoverCursor();
 *     },
 * });
 * ```
 */
export function extendState<
    E,
    C extends BaseContext,
    S extends string,
    O extends Partial<Record<keyof E, unknown>> = DefaultOutputMapping<E>,
>(
    original: ExtendableState,
    extension: StateExtension<E, C, S, O>
): State<E, C, S, O> {
    return new ExtendedState<E, C, S, O>(original, extension);
}

/**
 * The function {@link createStateExtender} returns: {@link extendState} with the
 * target generics already bound.
 *
 * @category Composition
 */
export type StateExtender<
    E,
    C extends BaseContext,
    S extends string,
    O extends Partial<Record<keyof E, unknown>>,
> = (
    original: ExtendableState,
    extension: StateExtension<E, C, S, O>
) => State<E, C, S, O>;

/**
 * Binds the target generics of {@link extendState} once so several states can
 * be extended without repeating them. Mirrors {@link createStateWidener}.
 *
 * @category Composition
 *
 * @example
 * ```typescript
 * const extend = createStateExtender<ExpEvents, ExpContext, ExpStates, ExpOut>();
 * const idle = extend(new KmtIdleState(), { eventReactions: { ... } });
 * ```
 */
export function createStateExtender<
    E,
    C extends BaseContext,
    S extends string,
    O extends Partial<Record<keyof E, unknown>> = DefaultOutputMapping<E>,
>(): StateExtender<E, C, S, O> {
    return (original, extension) =>
        extendState<E, C, S, O>(original, extension);
}
