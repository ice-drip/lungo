// rslib.config.ts
import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: { index: 'src/bin.ts' },
  },
  lib: [
    {
      format: 'cjs',
      syntax: 'es2021',
      output: {
        distPath: './dist',
        banner: { js: '#!/usr/bin/env node' },
      },
    },
  ],
  output: {
    cleanDistPath: true,
  },
});
