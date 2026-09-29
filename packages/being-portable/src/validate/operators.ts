import {
    BOOLEAN,
    NUMBER,
    STRING,
    ValueType,
    sameType,
    scalarType,
} from '../format/values';

/** Arity and typing of one operator. `type` returns a message on mismatch. */
export type OperatorRule = {
    readonly min: number;
    readonly max: number;
    readonly type: (args: readonly ValueType[]) => ValueType | string;
};

const MANY = Number.POSITIVE_INFINITY;

const isNumber = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'number';
const isString = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'string';
const isBoolean = (type: ValueType) =>
    type.kind === 'scalar' && type.scalar === 'boolean';

const numbers =
    (result: ValueType) =>
    (args: readonly ValueType[]): ValueType | string =>
        args.every(isNumber) ? result : 'expects numbers';

const booleans = (args: readonly ValueType[]): ValueType | string =>
    args.every(isBoolean) ? BOOLEAN : 'expects booleans';

const sameScalars = (args: readonly ValueType[]): ValueType | string =>
    args[0].kind === 'scalar' && sameType(args[0], args[1])
        ? BOOLEAN
        : 'expects two values of the same number, string or boolean type';

const listAndItem =
    (result: ValueType) =>
    (args: readonly ValueType[]): ValueType | string => {
        const [list, item] = args;
        return list.kind === 'list' &&
            item.kind === 'scalar' &&
            item.scalar === list.of
            ? result
            : 'expects a list and a value of its item type';
    };

const rule = (
    min: number,
    max: number,
    type: OperatorRule['type']
): OperatorRule => ({ min, max, type });

/** Every operator the language has. A Map, so no name can reach a prototype. */
export const OPERATORS: ReadonlyMap<string, OperatorRule> = new Map([
    ['+', rule(2, MANY, numbers(NUMBER))],
    ['*', rule(2, MANY, numbers(NUMBER))],
    ['-', rule(2, 2, numbers(NUMBER))],
    ['/', rule(2, 2, numbers(NUMBER))],
    ['%', rule(2, 2, numbers(NUMBER))],
    ['min', rule(2, MANY, numbers(NUMBER))],
    ['max', rule(2, MANY, numbers(NUMBER))],
    ['abs', rule(1, 1, numbers(NUMBER))],
    ['floor', rule(1, 1, numbers(NUMBER))],
    ['ceil', rule(1, 1, numbers(NUMBER))],
    ['round', rule(1, 1, numbers(NUMBER))],
    ['==', rule(2, 2, sameScalars)],
    ['!=', rule(2, 2, sameScalars)],
    ['<', rule(2, 2, numbers(BOOLEAN))],
    ['<=', rule(2, 2, numbers(BOOLEAN))],
    ['>', rule(2, 2, numbers(BOOLEAN))],
    ['>=', rule(2, 2, numbers(BOOLEAN))],
    ['and', rule(2, MANY, booleans)],
    ['or', rule(2, MANY, booleans)],
    ['not', rule(1, 1, booleans)],
    [
        'cond',
        rule(3, 3, ([condition, then, otherwise]) =>
            isBoolean(condition) && sameType(then, otherwise)
                ? then
                : 'expects a boolean and two values of the same type'
        ),
    ],
    [
        'concat',
        rule(2, MANY, args =>
            args.every(isString) ? STRING : 'expects strings'
        ),
    ],
    [
        'toString',
        rule(1, 1, ([value]) =>
            isNumber(value) || isBoolean(value)
                ? STRING
                : 'expects a number or a boolean'
        ),
    ],
    [
        'length',
        rule(1, 1, ([value]) =>
            isString(value) || value.kind === 'list'
                ? NUMBER
                : 'expects a string or a list'
        ),
    ],
    [
        'at',
        rule(2, 2, ([list, index]) =>
            list.kind === 'list' && isNumber(index)
                ? scalarType(list.of)
                : 'expects a list and a number'
        ),
    ],
    ['contains', rule(2, 2, listAndItem(BOOLEAN))],
    ['indexOf', rule(2, 2, listAndItem(NUMBER))],
    ['randomInt', rule(2, 2, numbers(NUMBER))],
    ['now', rule(0, 0, () => NUMBER)],
]);
