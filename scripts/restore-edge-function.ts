#!/usr/bin/env tsx
/**
 * Restore the original (unbundled) index.ts after deployment.
 */
import { existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname2 = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname2, '..');
const indexPath = resolve(ROOT, 'supabase/functions/api/index.ts');
const originalPath = resolve(ROOT, 'supabase/functions/api/index.original.ts');
const bundledPath = resolve(ROOT, 'supabase/functions/api/index.bundled.ts');

if (existsSync(originalPath)) {
  copyFileSync(originalPath, indexPath);
  unlinkSync(originalPath);
  console.log('✅ Restored original index.ts');
} else {
  console.log('No backup found — index.ts is already the original.');
}

if (existsSync(bundledPath)) {
  unlinkSync(bundledPath);
  console.log('   Cleaned up index.bundled.ts');
}
