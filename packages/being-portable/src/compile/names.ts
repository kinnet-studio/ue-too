import { Expr } from '../format/types';

const INFIX = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '==',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'and',
    'or',
]);

/** Longest guard label shown in graphs and devtools. */
export const MAX_GUARD_LABEL = 60;

function needsParentheses(expr: Expr): boolean {
    return (
        typeof expr === 'object' &&
        'op' in expr &&
        (INFIX.has(expr.op) || expr.op === 'not')
    );
}

function operand(expr: Expr): string {
    const text = printExpr(expr);
    return needsParentheses(expr) ? `(${text})` : text;
}

/** A readable one-line form of an expression, e.g. `balance >= payload.price`. */
export function printExpr(expr: Expr): string {
    if (typeof expr === 'string') {
        return JSON.stringify(expr);
    }
    if (typeof expr !== 'object') {
        return String(expr);
    }
    if ('list' in expr) {
        return `[${expr.list.map(printExpr).join(', ')}]`;
    }
    if ('ctx' in expr) {
        return expr.ctx;
    }
    if ('payload' in expr) {
        return `payload.${expr.payload}`;
    }
    if ('childCtx' in expr) {
        return `child.${expr.childCtx}`;
    }
    const args = expr.args ?? [];
    if (INFIX.has(expr.op)) {
        return args.map(operand).join(` ${expr.op} `);
    }
    if (expr.op === 'not') {
        return `not ${operand(args[0])}`;
    }
    return `${expr.op}(${args.map(printExpr).join(', ')})`;
}

/** The name an inline guard gets: its printed expression, truncated. */
export function guardLabel(expr: Expr): string {
    const text = printExpr(expr);
    return text.length > MAX_GUARD_LABEL
        ? `${text.slice(0, MAX_GUARD_LABEL - 1)}…`
        : text;
}

/** `base`, or `base #2`, `base #3`… when taken. */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
    if (!taken.has(base)) {
        return base;
    }
    let suffix = 2;
    while (taken.has(`${base} #${suffix}`)) {
        suffix += 1;
    }
    return `${base} #${suffix}`;
}
