import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    /*
     * Silenced deliberately. The default 500 kB warning fires on every build
     * because three and rapier are large by nature, and a warning that is
     * always present is one nobody reads. The real budgets are enforced by
     * `scripts/check-bundle.mjs`, which knows which chunk is allowed to be
     * big and fails the build when the *entry* chunk grows.
     */
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        /*
         * Split the heavy 3D dependencies so the UI shell (title screen,
         * loading screen, HUD) can paint before three and rapier finish
         * downloading on a slow school connection.
         *
         * This uses rolldown's native `codeSplitting.groups` rather than
         * Rollup's `manualChunks`. Vite 8 bundles with rolldown, which does
         * accept `manualChunks` but silently migrates it into a single group
         * whose *name* function does the work — the return value then names a
         * chunk instead of selecting modules into one, so every module ends up
         * claimed by that first group. The native form below states the match
         * and the name separately, which is what the split actually needs.
         *
         * `scripts/check-bundle.mjs` verifies the emitted chunks, because a
         * chunking rule that matches nothing still produces a valid build.
         */
        codeSplitting: {
          groups: [
            {
              name: 'rapier',
              test: /node_modules[\\/](@react-three[\\/]rapier|@dimforge)/,
              priority: 30,
            },
            {
              name: 'r3f',
              test: /node_modules[\\/]@react-three[\\/](fiber|drei)/,
              priority: 20,
            },
            {
              name: 'three',
              test: /node_modules[\\/](three|three-stdlib)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
