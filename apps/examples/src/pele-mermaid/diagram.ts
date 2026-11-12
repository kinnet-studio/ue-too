import { PeleError, render } from 'pele';

/**
 * Font stack Pele measures labels with. The page sets the same stack as
 * `--pele-font`, so the measured and the drawn text match.
 */
export const DIAGRAM_FONT =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export type DiagramResult =
    | { ok: true; element: SVGSVGElement; width: number; height: number }
    | { ok: false; message: string };

/**
 * Render Mermaid source with Pele and parse it into an `<svg>` element whose
 * top-left corner sits at (0, 0) of the camera group it is placed in.
 *
 * Never throws: a Pele parse error, or anything else, comes back as
 * `{ ok: false, message }`.
 */
export function renderDiagram(source: string): DiagramResult {
    try {
        const result = render(source, {
            responsive: false,
            fontFamily: DIAGRAM_FONT,
        });
        const doc = new DOMParser().parseFromString(
            result.svg,
            'image/svg+xml'
        );
        const element = doc.documentElement;
        if (!(element instanceof SVGSVGElement)) {
            return { ok: false, message: 'Pele did not return an <svg>.' };
        }
        element.setAttribute('x', '0');
        element.setAttribute('y', '0');
        return {
            ok: true,
            element,
            width: result.width,
            height: result.height,
        };
    } catch (error) {
        const message =
            error instanceof PeleError ? error.message : String(error);
        return { ok: false, message };
    }
}
