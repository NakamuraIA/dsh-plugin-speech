import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Every spec is a `.client.spec` file: the plugin's browser half needs a DOM, and
 * the host-facing specs are plain node modules that run unchanged under one. The
 * css-modules imports in the components resolve through Vite's own pipeline.
 *
 * `tests/checkout` is excluded: those specs compose the real client registries,
 * which only exist as sources inside a harness checkout (see its README).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    exclude: [...configDefaults.exclude, 'tests/checkout/**'],
  },
})
