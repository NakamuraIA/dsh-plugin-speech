/**
 * Self-contained build preset for a DeepSeek Harness client plugin. It emits
 * the same two artifacts a checkout build emits, without needing the checkout:
 *
 * - `lib/index.js`  — the node half: an ordinary ESM library whose production
 *   dependencies stay imports, because a real install materializes them beside it.
 * - `lib/client.js` — the browser half: a CommonJS closure factory handed to
 *   `window.__ModuleLoader__.load({ id, factory })`. Every specifier the loader's
 *   module table answers stays a `require`; everything else is inlined. CSS Modules
 *   are compiled here (hashed class map plus one injected style tag), because the
 *   browser fetches this bundle outside any Vite pipeline.
 *
 * The purity gate is the point of the external list: a cross-plugin value import
 * either duplicates a runtime instance inside this bundle or asks the module table
 * for a row it cannot answer. Both are build errors; collaboration across plugins
 * goes through cordis services.
 */
import { readFile } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { basename, dirname, isAbsolute, resolve as resolvePath } from 'node:path'
import { transform } from 'lightningcss'
import type { TsdownPlugin, UserConfig } from 'tsdown'

/**
 * Module-table rows this plugin may `require` at runtime: the React runtime the
 * shell preloads, the cordis entity, and the client packages its `dsh.client`
 * declaration injects. Only specifiers the code imports as values reach the
 * artifact — the rest are type-only and erased before this gate sees them.
 */
const MODULE_TABLE = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-chat',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-slots',
]

/**
 * Vendored libraries rescoped into `@deepseek-ai`: ordinary code with no shared
 * runtime identity, so inlining them is correct.
 */
const VENDORED_LIBRARY = /^@deepseek-ai\/(?:cosmokit|schemastery)(?:\/|$)/

/** Packages that stay imports in the node half: they are installed with it. */
const NODE_EXTERNALS = [/^@deepseek-ai\/schemastery(?:\/|$)/, /^msedge-tts(?:\/|$)/]

const CSS_MODULE_PREFIX = '\0dsh-css:'
const INLINE_CSS_PREFIX = '\0dsh-inline-css:'
const GLOBAL_CSS_PREFIX = '\0dsh-global-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** One style injector, plus the hashed class map for `*.module.css`. */
function styleModule(id: string, fileId: string, css: string, classMap?: Readonly<Record<string, string>>): string {
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css="\' + tagId + \'"]\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

/** Resolve a stylesheet import written in source to the file on disk. */
function stylesheetPath(source: string, importer: string | undefined): string {
  if (importer === undefined || isAbsolute(source)) return source
  return resolvePath(dirname(importer), source)
}

/** Compile and inject stylesheets the browser would otherwise have to fetch. */
function cssPlugin(id: string): TsdownPlugin {
  return {
    name: 'dsh-plugin-css-inline',
    resolveId(source, importer) {
      if (source.endsWith('.module.css')) return CSS_MODULE_PREFIX + stylesheetPath(source, importer) + CSS_VIRTUAL_SUFFIX
      if (source.endsWith('.css?inline')) {
        const sheet = source.slice(0, -'?inline'.length)
        return INLINE_CSS_PREFIX + stylesheetPath(sheet, importer) + CSS_VIRTUAL_SUFFIX
      }
      if (source.endsWith('.css')) return GLOBAL_CSS_PREFIX + stylesheetPath(source, importer) + CSS_VIRTUAL_SUFFIX
      return null
    },
    async load(virtualId) {
      if (virtualId.startsWith(INLINE_CSS_PREFIX)) {
        const fileId = virtualId.slice(INLINE_CSS_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const { code } = transform({ filename: fileId, code: await readFile(fileId), minify: true })
        return `export default ${JSON.stringify(code.toString())};`
      }
      if (virtualId.startsWith(CSS_MODULE_PREFIX)) {
        const fileId = virtualId.slice(CSS_MODULE_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: await readFile(fileId),
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        // Sorted so the emitted map is byte-identical across builds: lightningcss
        // returns the exports in hash order, which is not stable.
        for (const [local, exported] of Object.entries(cssExports ?? {})
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
          classMap[local] = exported.name
        }
        return styleModule(id, fileId, code.toString(), classMap)
      }
      if (virtualId.startsWith(GLOBAL_CSS_PREFIX)) {
        const fileId = virtualId.slice(GLOBAL_CSS_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const { code } = transform({ filename: fileId, code: await readFile(fileId), minify: true })
        return styleModule(id, fileId, code.toString())
      }
      return null
    },
  }
}

/** Whether a specifier names one module-table row, or a subpath of one. */
function isModuleTableRow(specifier: string): boolean {
  return MODULE_TABLE.some(row => specifier === row || specifier.startsWith(`${row}/`))
}

/**
 * Build both faces of one client plugin.
 * @param id - package name: the id the browser registers the bundle under and the tag stamped on injected styles.
 * @returns the tsdown configuration, selected per build face by tsdown itself.
 */
export function pluginBundle(id: string): UserConfig[] {
  const isNodeExternal = (specifier: string): boolean => NODE_EXTERNALS.some(pattern => pattern.test(specifier))
  return [
    {
      name: id,
      entry: ['src/index.ts'],
      outDir: 'lib',
      format: ['esm'],
      platform: 'node',
      target: 'es2024',
      fixedExtension: false,
      dts: false,
      clean: false,
      tsconfig: 'tsconfig.json',
      deps: {
        // Stating both halves takes the artifact off tsdown's production-dependency
        // fallback, where moving a dependency between npm sections silently
        // re-bundles the node half. Builtins keep tsdown's own handling.
        neverBundle: isNodeExternal,
        alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !isNodeExternal(specifier),
      },
      outputOptions: { entryFileNames: 'index.js' },
    },
    {
      name: `${id}/client`,
      entry: { client: 'src/client/index.ts' },
      outDir: 'lib',
      format: 'cjs',
      platform: 'browser',
      target: 'es2024',
      fixedExtension: false,
      dts: false,
      clean: false,
      // The bundle is fetched outside Vite's module graph, so it carries its own
      // TS/TSX mapping with the sources embedded.
      sourcemap: true,
      tsconfig: 'tsconfig.json',
      deps: {
        neverBundle: isModuleTableRow,
        alwaysBundle: (specifier: string) => !isModuleTableRow(specifier),
      },
      inputOptions: {
        resolve: {
          // Dual-mode libraries pick their flavor from NODE_ENV; a CommonJS bundle
          // cannot carry the top-level await of the node flavor.
          conditionNames: ['production', 'browser', 'import', 'module', 'default'],
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'import.meta.env.MODE': JSON.stringify('production'),
        'import.meta.env': JSON.stringify({ MODE: 'production' }),
      },
      plugins: [
        {
          name: 'dsh-plugin-bundle-purity',
          resolveId(source: string) {
            if (!source.startsWith('@deepseek-ai/')) return null
            if (isModuleTableRow(source) || VENDORED_LIBRARY.test(source)) return null
            throw new Error(
              `client bundle purity: "${source}" is neither a module-table row this plugin may require nor a vendored library — `
              + 'cross-plugin value imports are forbidden; declare the row in the client inject list or collaborate through cordis services '
              + '(type-only imports are erased and never reach this gate)',
            )
          },
        },
        cssPlugin(id),
      ],
      outputOptions: {
        entryFileNames: 'client.js',
        sourcemapExcludeSources: false,
        banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
        intro: 'var module = { exports: {} }; var exports = module.exports;',
        footer: 'return module.exports; } });',
      },
    },
  ]
}
