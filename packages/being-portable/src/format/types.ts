/**
 * A scalar type name.
 *
 * @category Types
 */
export type Scalar = 'number' | 'string' | 'boolean';

/**
 * A type written in a document: a bare scalar name, `{ "type": scalar }`, or
 * `{ "type": "list", "of": scalar }`.
 *
 * @category Types
 */
export type TypeSpec =
    | Scalar
    | { readonly type: Scalar }
    | { readonly type: 'list'; readonly of: Scalar };

/**
 * A scalar value.
 *
 * @category Types
 */
export type ScalarValue = number | string | boolean;

/**
 * Any value a portable machine can hold: a scalar or a list of one scalar
 * type. Lists are always frozen.
 *
 * @category Types
 */
export type Value = ScalarValue | readonly ScalarValue[];

/**
 * An expression. Bare scalars are literals.
 *
 * @category Types
 */
export type Expr =
    | ScalarValue
    | { readonly list: readonly Expr[]; readonly of?: Scalar }
    | { readonly ctx: string }
    | { readonly payload: string }
    | { readonly childCtx: string }
    | { readonly op: string; readonly args?: readonly Expr[] };

/**
 * A guard reference: the name of an entry in the state's `guards`, or an
 * inline boolean expression.
 *
 * @category Types
 */
export type GuardRef = string | Expr;

/**
 * A statement.
 *
 * @category Types
 */
export type Stmt =
    | { readonly set: string; readonly to: Expr }
    | { readonly push: string; readonly value: Expr }
    | { readonly removeAt: string; readonly index: Expr }
    | {
          readonly if: Expr;
          readonly then: readonly Stmt[];
          readonly else?: readonly Stmt[];
      }
    | {
          readonly call: string;
          readonly args?: Readonly<Record<string, Expr>>;
          readonly into?: string;
      }
    | { readonly output: Expr };

/**
 * A conditional transition, checked after `do`.
 *
 * @category Types
 */
export type Branch = { readonly if: GuardRef; readonly target: string };

/**
 * What a state does when it receives one event.
 *
 * @category Types
 */
export type Reaction = {
    readonly require?: readonly GuardRef[];
    readonly do?: readonly Stmt[];
    readonly branches?: readonly Branch[];
    readonly target?: string;
};

/**
 * What a state does when its child machine reaches a final state.
 *
 * @category Types
 */
export type DoneReaction = Omit<Reaction, 'require'>;

/**
 * A state hosting a child machine.
 *
 * @category Types
 */
export type ChildDefinition = {
    readonly machine: string;
    readonly with?: Readonly<Record<string, Expr>>;
};

/**
 * One state.
 *
 * @category Types
 */
export type StateDefinition = {
    readonly final?: boolean;
    readonly guards?: Readonly<Record<string, Expr>>;
    readonly enter?: readonly Stmt[];
    readonly exit?: readonly Stmt[];
    readonly on?: Readonly<Record<string, Reaction>>;
    readonly child?: ChildDefinition;
    readonly onDone?: DoneReaction;
};

/**
 * One context field with its type and initial value.
 *
 * @category Types
 */
export type ContextFieldDefinition =
    | { readonly type: Scalar; readonly initial: ScalarValue }
    | {
          readonly type: 'list';
          readonly of: Scalar;
          readonly initial: readonly ScalarValue[];
      };

/**
 * A host capability a document calls.
 *
 * @category Types
 */
export type EffectDeclaration = {
    readonly args: Readonly<Record<string, TypeSpec>>;
    readonly returns?: TypeSpec;
};

/**
 * The parts every machine has, root or child.
 *
 * @category Types
 */
export type MachineBody = {
    readonly context: Readonly<Record<string, ContextFieldDefinition>>;
    readonly events: Readonly<
        Record<string, Readonly<Record<string, TypeSpec>>>
    >;
    readonly outputs?: Readonly<Record<string, TypeSpec>>;
    readonly initialState: string;
    readonly states: Readonly<Record<string, StateDefinition>>;
};

/**
 * A complete portable machine definition document.
 *
 * @category Types
 */
export type MachineDefinition = MachineBody & {
    readonly format: 'being-machine@1';
    readonly id: string;
    readonly revision: number;
    readonly effects?: Readonly<Record<string, EffectDeclaration>>;
    readonly machines?: Readonly<Record<string, MachineBody>>;
};

/**
 * The running state of one machine level inside a snapshot.
 *
 * @category Types
 */
export type LevelSnapshot = {
    readonly state: string;
    readonly context: Readonly<Record<string, Value>>;
    readonly child?: LevelSnapshot;
};

/**
 * A snapshot of a running machine tree.
 *
 * @category Types
 */
export type MachineSnapshot = LevelSnapshot & {
    readonly format: 'being-snapshot@1';
    readonly machine: { readonly id: string; readonly revision: number };
};
