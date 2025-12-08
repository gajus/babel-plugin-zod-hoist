import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: path.resolve(import.meta.dirname, './testSetup.ts'),
  },
});
