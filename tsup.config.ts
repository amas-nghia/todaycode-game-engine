import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    gamecore: 'packages/gamecore/src/index.ts',
    farmwars: 'packages/farmwars/src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  outDir: 'dist',
});
