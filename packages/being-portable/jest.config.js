/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['<rootDir>/test/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\.ts$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.spec.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@ue-too/(.*)$': '<rootDir>/../$1/src',
    },
};
