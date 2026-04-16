import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@posx/shared-types': path.resolve(thisDir, '../../packages/shared-types/src'),
      '@posx/shared-utils': path.resolve(thisDir, '../../packages/shared-utils/src'),
      '@posx/api-contracts/endpoints': path.resolve(
        thisDir,
        '../../packages/api-contracts/src/endpoints',
      ),
      '@posx/api-contracts': path.resolve(thisDir, '../../packages/api-contracts/src'),
      '@': path.resolve(thisDir, 'src'),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});
