# Changelog

## 0.3.0

Requires DeepSeek Harness `0.2.2-rc.1` / Cordis `4.1`.

- **Pause and resume.** The action's second press now holds the voice instead of
  ending the reading, and the reply keeps being synthesized and buffered behind
  the hold, so resuming continues on the same word. Stopping moved to its own
  control, shown beside the toggle while a reply is the active one.
- **Continuous playback.** The pre-buffer grew from 1.5 s to 6 s, and a guard
  now watches the distance between the playhead and the last buffered byte,
  holding the voice under 2 s of lead and releasing it above 6 s. A reading no
  longer runs dry mid-sentence and restarts when the next chunk lands.
- **Replay cache.** A finished reply is kept in memory (8 replies or 64 MB,
  whichever comes first) and replayed without another synthesis, so a second
  listen is instant and can seek. Nothing reaches disk; the cache dies with the
  page, and a reply that arrived truncated is never cached.
- **Fixed: the last words of a reply were clipped** and the control stayed
  active. The buffer guard was still armed while the reply played out, and at
  the end of a reading the lead is zero by definition — so it held the voice a
  couple of seconds early and left the element paused short of `ended`. The
  guard is now released as soon as the body is drained.
- `ConfigFormSnapshot.mode` was removed upstream; the settings row reads
  `writable` instead of special-casing memory mode.
- Dev dependencies moved to `0.2.2-rc.1`, Cordis to `4.1.0`, `msedge-tts` to
  `2.1.1`, and the package now declares `engines.dsh`.
- 126 specs (was 116), including the pause, guard, cache and end-of-reply
  regressions.

## 0.2.1

- The whole reply is sent in **one request** and starts on a 1.5 s head,
  replacing the sentence-by-sentence chunker.
- Speak in segments into one buffer, and never start behind the voice.

## 0.2.0

- Migrated to the Host-owned config form (`ctx.configForms`), replacing
  `settings.register` and `ctx.settingsScope`.

## 0.1.0

First release: read-aloud action on every finalized assistant reply, the
Microsoft Edge provider, and a settings row in General.
