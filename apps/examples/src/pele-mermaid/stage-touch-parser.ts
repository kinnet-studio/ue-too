import { VanillaTouchEventParser } from '@ue-too/board';
import type { TouchPoints } from '@ue-too/board';

/**
 * Touch parser for an `<svg>` that has child elements.
 *
 * Browsers send `touchmove` to the element each touch started on, so when
 * two fingers start on different diagram elements every event's
 * `targetTouches` holds only one of them, and the board's two-finger
 * gestures fail. This parser reads every touch that started inside the
 * stage from `touches` instead.
 */
export class StageTouchEventParser extends VanillaTouchEventParser {
    constructor(
        stateMachine: ConstructorParameters<typeof VanillaTouchEventParser>[0],
        orchestrator: ConstructorParameters<typeof VanillaTouchEventParser>[1],
        private readonly stage: SVGSVGElement
    ) {
        super(stateMachine, orchestrator, stage);
    }

    override touchmoveHandler(e: TouchEvent): void {
        if (this.disabled) {
            return;
        }
        e.preventDefault();
        const points: TouchPoints[] = [];
        for (const touch of Array.from(e.touches)) {
            if (
                touch.target instanceof Node &&
                this.stage.contains(touch.target)
            ) {
                points.push({
                    ident: touch.identifier,
                    x: touch.clientX,
                    y: touch.clientY,
                });
            }
        }
        const result = this.stateMachine.happens('touchmove', { points });
        if (
            result.handled &&
            'output' in result &&
            result.output !== undefined
        ) {
            this.orchestrator.processInputEventOutput(result.output);
        }
    }
}
