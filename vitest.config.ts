import { defineConfig } from 'vitest/config';

// Root vitest config.
//
// Picks up tests from test directories under:
//   - packages (domain-rules, shared-utils, etc.)
//   - supabase/functions/_shared (service layer)
//   - apps (frontend unit tests, future)
//
// Path aliases mirror the pnpm workspace so tests can import from
// @posx packages without a build step. The aliases intentionally
// point at source files, not dist -- every package in this repo
// exports TypeScript directly.
//
// NOTE: do NOT use a /** JSDoc block comment here. ESBuild's comment
// lexer terminates on the first close-comment marker it sees inside
// the block, and the `include` patterns below contain that sequence
// as string literals. Keep this header as line comments.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/test/**/*.test.ts',
      'supabase/functions/_shared/test/**/*.test.ts',
      'apps/**/test/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'packages/*/src/**/*.ts',
        'supabase/functions/_shared/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/test/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@posx/shared-types': new URL('./packages/shared-types/src/index.ts', import.meta.url)
        .pathname,
      '@posx/shared-utils': new URL('./packages/shared-utils/src/index.ts', import.meta.url)
        .pathname,
      '@posx/domain-rules': new URL('./packages/domain-rules/src/index.ts', import.meta.url)
        .pathname,
      '@posx/api-contracts': new URL('./packages/api-contracts/src/index.ts', import.meta.url)
        .pathname,
      '@posx/config': new URL('./packages/config/src/index.ts', import.meta.url).pathname,
      '@posx/test-utils': new URL('./packages/test-utils/src/index.ts', import.meta.url).pathname,
      '@posx/backend-core': new URL(
        './supabase/functions/_shared/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
