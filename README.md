<div align="center">
  <img src="brand/logo.svg" width="72" height="72" alt="">
  <h1>YouTube Triage</h1>
  <p><strong>Clear your Watch Later by swiping.</strong><br>
  Left to remove, right to keep, up to watch. No account, no backend, no tracking.</p>
</div>

---

YouTube Triage turns your Watch Later playlist into a card stack. Each card shows the
thumbnail, title, channel, length and how much you have already watched. Decide, and the
next one slides in.

| Gesture     | Key       | Effect                                         |
| ----------- | --------- | ---------------------------------------------- |
| Swipe left  | `←`       | Remove from Watch Later                        |
| Swipe right | `→`       | Keep it and move on                            |
| Swipe up    | `↑`       | Open it in a new tab, keep it                  |
| Undo button | `Z` / `⌫` | Undo the last decision, back to its old place  |
| Close       | `Esc`     | Close; the Watch Later page reloads if changed |

Open it with the toolbar button (from any tab) or the **Triage** button on
`youtube.com/playlist?list=WL`.

## Install

Download the latest build from [`releases/`](releases/), then follow
[docs/distribution.md](docs/distribution.md):

- **Firefox 142+**: drag the signed `.xpi` onto a Firefox window.
- **Chrome, Edge, Brave, Arc**: unzip, then _Load unpacked_ in `chrome://extensions`.

From source: `pnpm install && pnpm build:all`, then load `dist/` unpacked in Chrome or
`dist-firefox/manifest.json` from `about:debugging#/runtime/this-firefox` in Firefox. After a
rebuild, reload the extension, then reload the YouTube tab.

## How it works

A page-world script calls the same InnerTube endpoints youtube.com uses for its own
"Remove from Watch later" menu (`browse` and `browse/edit_playlist`), signed with your
existing session. Undo re-adds the video and moves it back before its original neighbour.
Writes run one at a time, in order, so an undo always lands after the removal it reverses.

The extension requests no permissions beyond running on `www.youtube.com`.

## Development

```sh
pnpm dev        # Vite + CRXJS with hot reload, load dist/ unpacked
pnpm verify     # format, typecheck, tests, Chrome + Firefox builds
pnpm lint:firefox
pnpm brand      # regenerate icons and brand/logo.svg
pnpm ship patch # bump, verify, sign the Firefox XPI, refresh releases/
```

| Path                         | Role                                                |
| ---------------------------- | --------------------------------------------------- |
| `src/page/innertube.iife.ts` | Page world: reads and edits Watch Later             |
| `src/page/parse.ts`          | InnerTube response parsing                          |
| `src/content/bridge.ts`      | Typed, validated requests to the page world         |
| `src/content/triage/`        | Card stack, swipe physics, decisions and undo queue |
| `src/background/index.ts`    | Toolbar button                                      |
