import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@crag-to-all/shared-crag': path.resolve(__dirname, '../../packages/shared-crag/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
