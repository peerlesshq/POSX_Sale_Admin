/**
 * Root ESLint config for the POSX Token Sale System monorepo.
 *
 * Scope (Phase 2):
 * - covers all TypeScript files under packages/* and apps/* (once populated)
 * - Prettier handles formatting; ESLint handles correctness + style rules
 *   that do not conflict with Prettier
 * - import ordering plugin intentionally deferred until Phase 4 backend
 *   work to avoid pulling in the typescript resolver this early
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  ignorePatterns: [
    'dist',
    'build',
    'node_modules',
    '.turbo',
    '*.cjs',
    '*.config.*',
    'coverage',
    'supabase/migrations',
  ],
};
