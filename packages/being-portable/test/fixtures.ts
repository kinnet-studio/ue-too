/** A loosely typed document tests can edit freely before loading. */
export type Doc = Record<string, any>;

const plus = (field: string, payloadField: string) => ({
    set: field,
    to: { op: '+', args: [{ ctx: field }, { payload: payloadField }] },
});

/** The vending machine from the design spec. Fresh object every call. */
export function vendingDoc(): Doc {
    return {
        format: 'being-machine@1',
        id: 'vending',
        revision: 1,
        context: {
            balance: { type: 'number', initial: 0 },
            sold: { type: 'list', of: 'string', initial: [] },
        },
        events: {
            insertCoin: { amount: 'number' },
            select: { item: 'string', price: 'number' },
            cancel: {},
        },
        outputs: { select: 'number' },
        effects: {
            dispense: { args: { item: 'string' } },
            refund: { args: { amount: 'number' } },
        },
        initialState: 'IDLE',
        states: {
            IDLE: {
                on: {
                    insertCoin: {
                        do: [plus('balance', 'amount')],
                        target: 'HAS_MONEY',
                    },
                },
            },
            HAS_MONEY: {
                guards: {
                    canAfford: {
                        op: '>=',
                        args: [{ ctx: 'balance' }, { payload: 'price' }],
                    },
                },
                on: {
                    insertCoin: { do: [plus('balance', 'amount')] },
                    select: {
                        require: ['canAfford'],
                        do: [
                            {
                                call: 'dispense',
                                args: { item: { payload: 'item' } },
                            },
                            {
                                set: 'balance',
                                to: {
                                    op: '-',
                                    args: [
                                        { ctx: 'balance' },
                                        { payload: 'price' },
                                    ],
                                },
                            },
                            { push: 'sold', value: { payload: 'item' } },
                            { output: { ctx: 'balance' } },
                        ],
                        branches: [
                            {
                                if: { op: '>', args: [{ ctx: 'balance' }, 0] },
                                target: 'HAS_MONEY',
                            },
                        ],
                        target: 'IDLE',
                    },
                    cancel: {
                        do: [
                            {
                                call: 'refund',
                                args: { amount: { ctx: 'balance' } },
                            },
                            { set: 'balance', to: 0 },
                        ],
                        target: 'IDLE',
                    },
                },
            },
        },
    };
}

/** A two-level game: PLAYING hosts a `turn` child that finishes in DONE. */
export function gameDoc(): Doc {
    return {
        format: 'being-machine@1',
        id: 'game',
        revision: 1,
        context: {
            players: { type: 'number', initial: 2 },
            score: { type: 'number', initial: 0 },
            log: { type: 'list', of: 'string', initial: [] },
        },
        events: { begin: {}, roll: { value: 'number' }, quit: {} },
        effects: { note: { args: { text: 'string' } } },
        machines: {
            turn: {
                context: {
                    points: { type: 'number', initial: 0 },
                    playerCount: { type: 'number', initial: 0 },
                },
                events: { roll: { value: 'number' } },
                initialState: 'ROLLING',
                states: {
                    ROLLING: {
                        enter: [
                            {
                                call: 'note',
                                args: { text: 'turn starts' },
                            },
                        ],
                        exit: [{ call: 'note', args: { text: 'turn ends' } }],
                        on: {
                            roll: {
                                do: [
                                    {
                                        set: 'points',
                                        to: {
                                            op: '*',
                                            args: [
                                                { payload: 'value' },
                                                { ctx: 'playerCount' },
                                            ],
                                        },
                                    },
                                ],
                                target: 'DONE',
                            },
                        },
                    },
                    DONE: { final: true },
                },
            },
        },
        initialState: 'LOBBY',
        states: {
            LOBBY: { on: { begin: { target: 'PLAYING' } } },
            PLAYING: {
                enter: [{ push: 'log', value: 'enter PLAYING' }],
                exit: [{ push: 'log', value: 'exit PLAYING' }],
                child: {
                    machine: 'turn',
                    with: { playerCount: { ctx: 'players' } },
                },
                onDone: {
                    do: [
                        {
                            set: 'score',
                            to: {
                                op: '+',
                                args: [
                                    { ctx: 'score' },
                                    { childCtx: 'points' },
                                ],
                            },
                        },
                    ],
                    target: 'LOBBY',
                },
                on: { quit: { target: 'LOBBY' } },
            },
        },
    };
}
