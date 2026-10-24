# Checkout-only specs

These specs compose the **real** client registries — `SlotRegistry`,
`LocaleRuntime`, the settings provider, and the component-level rendering
helpers. That is only possible where those packages are available as *sources*:
a DeepSeek Harness checkout, whose `tsconfig.base.json` path facade maps every
`@deepseek-ai/dsh-client-*` import to `packages/client/*/src`.

They cannot run against the published npm packages, for two structural reasons:

- A published client package ships `lib/client.js` only: a
  `window.__ModuleLoader__.load({ id, factory })` handoff, not an ES module, so
  `import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'`
  has nothing to bind.
- `@deepseek-ai/dsh-client-test-runtime` imports two source paths that are not
  published at all (`dsh-client-ui-renderer/src/client/bind.ts`,
  `dsh-client-ui-session/client`).

`vitest.config.ts` therefore excludes this directory, and `tsconfig.test.json`
does the same. What the standalone lane covers instead is in
`../wiring.client.spec.ts`: the same client wiring driven through doubles for
every injected service, plus the whole host half in `../host.client.spec.ts`.

## Running them

Copy `src/` and this directory into a checkout's `packages/client/ui-speech/`
(the package name and layout there match) and run the checkout's own test lanes:

```sh
pnpm vitest run packages/client/ui-speech
```

Their expectations follow the `0.2.0-rc.2` contract — `ctx.configForms` for the
settings form, the volatile-leaf entry config on the host — so they match the
sources in this repository. They have not been executed here.
