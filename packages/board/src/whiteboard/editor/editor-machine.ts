import {
    type BaseContext,
    DelegatingState,
    type EventGuards,
    type EventReactions,
    type Guard,
    type HostableStateMachine,
    NO_OP,
    TemplateStateMachine,
} from '@ue-too/being';

import { TOOL_NAMES, type ToolEvents, type ToolName } from './events';

/**
 * The editor machine's context: which tool `pickTool` should switch to.
 *
 * @group Whiteboard Editor
 */
export interface EditorMachineContext extends BaseContext {
    requestedTool: ToolName;
}

const TOOL_GUARDS = Object.fromEntries(
    TOOL_NAMES.map(name => [
        name,
        (context: EditorMachineContext) => context.requestedTool === name,
    ])
) as Record<ToolName, (context: EditorMachineContext) => boolean>;

const TOOL_ROUTES = TOOL_NAMES.map(name => ({ guard: name, target: name }));

/**
 * One editor state per tool, hosting that tool's own machine: events go to
 * the tool first, and `pickTool` moves to the tool the editor asked for.
 */
class ToolHostState extends DelegatingState<
    ToolEvents,
    EditorMachineContext,
    ToolName,
    HostableStateMachine
> {
    protected _eventReactions = {
        pickTool: { action: NO_OP },
    } as EventReactions<ToolEvents, EditorMachineContext, ToolName>;
    protected _guards: Guard<EditorMachineContext> = TOOL_GUARDS;
    protected _eventGuards: Partial<
        EventGuards<
            ToolEvents,
            ToolName,
            EditorMachineContext,
            Guard<EditorMachineContext>
        >
    > = { pickTool: TOOL_ROUTES };
}

/**
 * The editor's top-level machine: a state per tool, each delegating to that
 * tool's machine.
 *
 * @group Whiteboard Editor
 */
export function createEditorMachine(
    machines: Record<ToolName, HostableStateMachine>,
    context: EditorMachineContext,
    initial: ToolName
): TemplateStateMachine<ToolEvents, EditorMachineContext, ToolName> {
    const states = Object.fromEntries(
        TOOL_NAMES.map(name => [name, new ToolHostState(machines[name])])
    ) as Record<ToolName, ToolHostState>;
    return new TemplateStateMachine<ToolEvents, EditorMachineContext, ToolName>(
        states,
        initial,
        context
    );
}
