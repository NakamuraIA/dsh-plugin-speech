# dsh-plugin-speech

English | [中文](README.zh.md)

![Read aloud — DeepSeek Harness speech plugin](docs/cover.jpg)

Read assistant replies aloud in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with the audio streamed while it is still being generated.

## What it does

Each finished assistant message gets a play control in its action row. Press it and the reply is spoken through a text-to-speech service; press it again and it stops. A settings row in General owns the service, the voice, and the tuning.

The reply is sent in one request and the audio is played **as it arrives**, so speech starts on the first frames instead of waiting for the whole file. The equivalent of watching an answer stream in, for audio.

## Providers

| Service | Key needed | Voices |
|---|---|---|
| **Microsoft Edge** (default) | no | the service publishes its full catalog, every language it serves |

Adding a provider means adding one folder under `src/providers/` and one line in `src/providers/registry.ts` — the settings screen builds its fields from what the provider declares.

### The Edge token

Every handshake carries a short-lived `Sec-MS-GEC` token: the current time in Windows file-time ticks, rounded down to five minutes, digested together with the well-known client token. In October 2026 the endpoint moved to a **second generation** of that token — a patched SHA-256 paired with a 64-bit checksum — and began answering the first generation with a bare `403` (`Edge TTS WebSocket error: Unexpected server response: 403`), which is what a reply that never speaks looks like from the browser. `src/providers/edge/gec.ts` reproduces the accepted generation; `server.ts` hands it to `msedge-tts` by replacing the library's private URL builder, which is also what pins the token version the endpoint now expects. If read-aloud stops working again, test that token first: it is the only part of this plugin that can expire without the code changing.

## Requirements

- A DeepSeek Harness surface — `dsh web`, or the desktop app — version `0.2.0-rc.2` or newer.
- Network access to the speech service. Nothing else: there is no model to download, and the Edge provider needs no account.

The version floor is not decorative. The plugin's preferences are its own Cordis entry config, exposed to the settings screen as a form through `ctx.configForms`. Releases before `0.2.0-rc.2` had plugins register settings namespaces themselves (`settings.register`) and handed the browser a `ctx.settingsScope`; both services are gone.

## Install

This package declares `dsh.bundle.patch`, so it installs as a **profile bundle**: the package
manager links it, the launcher appends it to the profile's `dsh.profile.bundles`, and the
bundle's own patch layer inserts the plugin row. Installing also enables it — in DeepSeek
Harness, installing a plugin and enabling it in a profile are separate steps, and a bundle
collapses the two.

**Desktop app** — sidebar → **Plugins** → **Add plugin**, then give one of:

- `@nakamuraia/dsh-plugin-speech` (the npm registry)
- `github:NakamuraIA/dsh-plugin-speech`
- an absolute path to a local checkout

**From the CLI** — the same operation, profile-scoped:

```sh
dsh plugin --profile web add github:NakamuraIA/dsh-plugin-speech
```

Restart the surface afterwards. The host half claims its HTTP routes when the plugin loads,
a desktop profile is owned by the app, and a newly installed out-of-tree bundle is not mounted
by a live recomposition — an app-internal row added to a patch does reload immediately, a
package that has to come from the profile's `node_modules` does not.

### One-off overlay, without installing

`cordis.patch.yml` is the same patch the bundle applies, so it also works as a temporary
command-line overlay:

```sh
dsh web --patch ./cordis.patch.yml
```

Do **not** do both. A profile patch that inserts `ui-speech` while the bundle is selected
collides with `duplicate loader entry id`; the profile layer is for overriding the row's
config, which is what the settings screen writes.

The **row name** is the package name and also the browser module id the built bundle registers
under; the **row id** (`ui-speech`) is the settings namespace the config form is keyed by.
Nothing works if either one drifts, so change the two together.

## Settings

Settings opens on **General**, where a **Read aloud** row owns:

- **Service** — which provider speaks.
- **Language** and **Voice** — the catalog entry to use.
- **Speed**, **Volume**, **Pitch** — sent to the service with every request.
- **Skip code** — leave fenced code and inline code out of the reading.
- **Test voice** — speaks a sample through the settings on screen, saved or not.

The row edits the plugin's own entry config, so the chosen values persist in the profile patch beside the entry rather than in a settings document. Resetting a field restores the schema default, and a write the Host refuses leaves the stored value untouched while the row says so.

Code blocks, tables, and pasted spreadsheets are never read; links keep their label and lose their target; emoji, quotes, and standalone symbols are dropped. Sentence punctuation is kept, because the voice uses it for pauses.

## How it works

```
browser                    host                        service
───────                    ────                        ───────
click ─ ▶ POST /speech/speak { text }
                           select provider from
                           its own entry config
                           ────────────────────────── ▶ synthesize
        ◀ ─ audio bytes stream back ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
play as they arrive
```

Synthesis lives on the host because a browser cannot hold an API key and cannot reach most services across CORS. The browser only posts text and plays bytes. Every editable leaf of the entry config is `.volatile()`, so a settings write lands in the running host without reloading it — the host reads the same value the browser wrote.

## Development

This repository builds on its own against the published `@deepseek-ai/*` packages; no harness checkout is involved:

```sh
pnpm install
pnpm build      # tsc → lib/types, tsdown → lib/index.js + lib/client.js
pnpm test       # vitest
pnpm typecheck  # sources and specs
```

`build/plugin-bundle.ts` is the client-bundle preset. It emits the `window.__ModuleLoader__.load` handoff, keeps every module-table row a `require`, compiles CSS Modules into one injected style tag, and fails the build on a cross-plugin value import. It is a self-contained copy of the harness preset, which is what lets the package be built here.

Three specs under `tests/checkout/` compose the real client registries, which only exist as sources inside a harness checkout; `tests/checkout/README.md` explains why and how to run them. Everything else, including the client wiring, runs through `pnpm test`.

### Migrating from 0.1.x

- The host half exports `Config` — the schemastery schema with `.volatile()` leaves — and no longer calls `settings.register`; the synthesis route reads the entry config it was handed at apply time.
- The client half takes `ctx.configForms.get('ui-speech')` instead of `ctx.settingsScope.bind(...)`, and a write reports acceptance directly (`Promise<boolean>`) instead of being checked against the settled section.
- Icons from `@deepseek-ai/dsh-client-ui-primitives` are named by weight (`IconPlayOutlineRegular`), not by drawn size (`IconPlayOutline16`).

## License

MIT. The Edge provider drives Microsoft's read-aloud endpoint through [`msedge-tts`](https://github.com/harvey-woo/msedge-tts) (MIT); that endpoint is not a documented, supported Microsoft API, so treat availability as best effort.
