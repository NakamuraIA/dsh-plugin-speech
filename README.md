# dsh-plugin-speech

English | [中文](README.zh.md)

Read assistant replies aloud in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with the audio streamed while it is still being generated.

## What it does

Each finished assistant message gets a play control in its action row. Press it and the reply is spoken through a text-to-speech service; press it again and it stops. A settings row in General owns the service, the voice, and the tuning.

The reply is sent in one request and the audio is played **as it arrives**, so speech starts on the first frames instead of waiting for the whole file. The equivalent of watching an answer stream in, for audio.

## Providers

| Service | Key needed | Voices |
|---|---|---|
| **Microsoft Edge** (default) | no | the service publishes its full catalog, every language it serves |

Adding a provider means adding one folder under `src/providers/` and one line in `src/providers/registry.ts` — the settings screen builds its fields from what the provider declares.

## Requirements

- A DeepSeek Harness Web surface (`dsh web`), version `0.1.5-rc.2` or newer.
- Network access to the speech service. Nothing else: there is no model to download, and the Edge provider needs no account.

## Install

1. Add the package to your harness checkout:

   ```sh
   pnpm add -w @nakamuraia/dsh-plugin-speech
   ```

   Installing from GitHub works the same way, if you would rather track the source:

   ```sh
   pnpm add -w github:NakamuraIA/dsh-plugin-speech
   ```

2. Copy `speech.patch.yml` next to the checkout and start the Web surface with it:

   ```sh
   dsh web --patch ./speech.patch.yml
   ```

The patch adds one Loader row. The row name is the package name and also the browser module id the built bundle registers under, so the two stay in step — do not rename one without the other.

## Settings

Settings opens on **General**, where a **Read aloud** row owns:

- **Service** — which provider speaks.
- **Language** and **Voice** — the catalog entry to use.
- **Speed**, **Volume**, **Pitch** — sent to the service with every request.
- **Skip code** — leave fenced code and inline code out of the reading.
- **Test voice** — speaks a sample through the settings on screen, saved or not.

Code blocks, tables, and pasted spreadsheets are never read; links keep their label and lose their target; emoji, quotes, and standalone symbols are dropped. Sentence punctuation is kept, because the voice uses it for pauses.

## How it works

```
browser                    host                        service
───────                    ────                        ───────
click ─ ▶ POST /speech/speak { text }
                           select provider from
                           the durable settings
                           ────────────────────────── ▶ synthesize
        ◀ ─ audio bytes stream back ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
play as they arrive
```

Synthesis lives on the host because a browser cannot hold an API key and cannot reach most services across CORS. The browser only posts text and plays bytes.

## Development

The source is developed inside a DeepSeek Harness checkout, where the type packages and the client build preset live; this repository carries the source and the built artifacts. To rebuild, copy `src/` into `packages/client/ui-speech/` of a checkout, rename the package there, and run its build.

## License

MIT. The Edge provider drives Microsoft's read-aloud endpoint through [`msedge-tts`](https://github.com/harvey-woo/msedge-tts) (MIT); that endpoint is not a documented, supported Microsoft API, so treat availability as best effort.
