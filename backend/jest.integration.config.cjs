module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/integration'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.integration.json'
      }
    ]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration/setup.ts'],
  clearMocks: true,
  verbose: true
};