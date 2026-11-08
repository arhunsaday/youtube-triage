# Install YouTube Triage

Each release folder holds a Chrome zip, a Mozilla-signed Firefox XPI and `SHA256SUMS.txt`.
Compare the hashes before installing.

## Firefox 142+

Drag `youtube-triage-<version>-firefox-signed.xpi` onto a Firefox window (or `about:addons` →
gear → _Install Add-on From File_) and accept. The add-on survives restarts; a newer XPI
installs over it.

## Chrome, Edge, Brave, Arc

Unzip `youtube-triage-<version>-chrome.zip` into a folder you keep. Open `chrome://extensions`,
turn on developer mode, _Load unpacked_, pick that folder. To update, replace the folder's
contents and reload the extension. There are no automatic updates.

## Publish a release

Once: create an account on [addons.mozilla.org](https://addons.mozilla.org), generate API keys
in Developer Hub → Manage API Keys, and put them in a git-ignored `.env`:

```sh
WEB_EXT_API_KEY=user:…
WEB_EXT_API_SECRET=…
```

Then:

```sh
pnpm ship patch   # or minor, major, 1.2.3; no argument keeps the current version
```

It bumps the version if asked, runs `pnpm verify` and `web-ext lint`, zips the Chrome build,
has Mozilla sign the Firefox build on the unlisted channel (nothing is listed on
addons.mozilla.org), and leaves only this release in `releases/`, staged for git. Commit and
push. Mozilla signs each version number once, so every release needs a new version.

Keep the Firefox ID `youtube-triage@arhunsaday`: it ties updates and settings together.
