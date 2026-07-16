# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` (alias `npm test`) — run the app in development via `electron-forge start`.
- `npm run make` (alias `npm run build`) — build platform distributables (Squirrel installer on Windows, DMG on macOS).
- `npm run package` — package the app without making installers.
- `npm run publish` — publish a release to GitHub (uses tokens in `src/tokens.js`).
- `npm run lint` is a no-op stub (`echo "No linting configured"`). There is no linter and no automated test suite — `test` just launches the app.

## Untracked files required to run

- **Secrets** are read from the environment at **build/publish time only** via `src/config/secrets.js` (loads `.env` through `dotenv`/`dotenv-expand`). Copy `.env.example` → `.env` (git-ignored) for local builds; in CI use repository secrets. The packaged app no longer bundles any secret. `forge.config.js`'s `packagerConfig.ignore` keeps `.env` and the legacy `src/tokens.js` out of the build. The old `src/tokens.js` (hard-coded GitHub PATs / Apple password / AES key) is **deprecated and no longer referenced** — delete it after rotating those credentials.
- Local data files (`settings`, `user`) are obfuscated with **AES-256-GCM** (authenticated). The key is a per-install random value managed by `src/dataKey.js` via Electron `safeStorage` (OS keychain) — never hard-coded, never shipped. Treat the local store as obfuscation, not a security boundary. Legacy AES-256-CTR data from older versions will fail to decrypt and fall back to defaults / re-login (acceptable for the beta).
- `src/functions.js` — the shared utility module (see below) — is git-ignored but **required**; a fresh clone must recreate it.

Also git-ignored: `src/installs/`, `src/downloads/`, `src/data/`, `out/`, `.env`.

## Architecture

This is an Electron desktop launcher, but it does **not** load HTML over `file://`. Instead:

1. `src/index.js` (Electron main process) starts up, then `require("./launcher")` boots a **local Express server on port 1520** (falls back to 1521 if another instance is already running — detected by pinging `/api/close-for-update` on startup).
2. The `BrowserWindow` loads pages over `http://localhost:<PORT>/...`. So the "frontend" is served by Express and the "backend" is a local web server inside the same Electron process.

### Access control via User-Agent token
`launcherConfig.requestToken` (`"SketchyGamesLauncher"`) is appended to the window's User-Agent (`index.js`). The Express middleware in `launcher.js` rejects any request whose UA does not end with that token, so the local server is only reachable from the Electron window, not an external browser.

### Backend layers
- `src/launcher.js` — Express app: token middleware, static `/res` and page routing (`GET *` serves `src/frontend/<path>/index.html`, redirects to `/error` otherwise), mounts the API router at `/api`.
- `src/api.js` — the API router; ~40 REST endpoints under `/api` (store, downloads, account/login/signup, games start/open/delete, settings, notifications, updates, patch-notes). It proxies to the remote backend at **`api.sketch-company.de`** via `functions.js` helpers and manages a serial **download queue** (`https.get` → write `.zip` to `downloads/` → SHA-256 verify → zip-slip-safe `safeExtract` into the installs dir → optional shortcut). Most handlers respond with `{ status: 1|0, data }`. Privileged endpoints (`games/start`/`open`/`delete`, `library/img`) never act on raw request paths — they resolve the product from the `installsFile` registry via `resolveRegisteredProduct()` and enforce `isPathInside()` containment.
- `src/functions.js` — shared utilities: `fs.promises`-based ops (`read`/`write`/`remove`/`move`/`mkDir`/`readDir`) that **reject on error** (every caller awaits inside try/catch — keep that), HTTP helpers (`get`, `getAndCache` with `node-cache`, `send` — also reject), `encrypt`/`decrypt` (**AES-256-GCM**, key from `src/dataKey.js` via `safeStorage`), cross-platform launch helpers `launchProgram()`/`openExternal()`, `createShortcut()` (Windows-only, no-op elsewhere), Electron dialogs/notifications, `checkInternetConnection` (2=internet+server, 1=internet only, 0=offline), `getRepository` (unauthenticated GitHub releases → patch notes), `filterForPlatform`. Git-ignored but required.
- `src/launcherConfig.js` — all paths, constants, `ROLES`/`LEVELS`, platform-aware `appExt` (`.exe`/`.app`/``), the `settingsIntegrity` default-settings shape, and `setup()`/`checkForUpdates()` (both plain `async` with internal try/catch). `checkForUpdates()` is the single source for the update check (also called by `/api/updates/pull`). `setup()` runs on window create: creates dirs/files, cleans `downloads/`, prunes installs whose executable is missing, re-downloads cover images, and checks for product updates.

### Data & filesystem layout
- `globalDir` = `<userData parent>/Sketchy Games Launcher/` — shared across launcher versions. Holds `installs/` and `data/`.
- Local state files use the `.data` extension: `installsFile`, `updatesFile` (plain JSON), and `userFile` + `settingsFile` (**AES-256-GCM** via `func.encrypt`/`decrypt`). When reading user/settings, always decrypt then `JSON.parse`; fall back to `settingsIntegrity` on failure (also covers legacy CTR data that can no longer be decrypted). `key.dat` in the data dir holds the GCM key (safeStorage-wrapped).
- `func.checkForIntegrity(obj, settingsIntegrity)` validates the settings shape; a mismatch overwrites the file with defaults.

### Content filtering
Store results are filtered twice: by `process.platform` (`filterForPlatform`) and by the user's role/level (`ROLES` admin/dev/user → `LEVELS` 100/50/1) in the `/api/store` handler.

### Frontend
`src/frontend/` is a multi-page jQuery app. Each route is a folder (`library/`, `store/`, `account/`, `settings/`, `downloads/`, etc.) with an `index.html`; shared assets live in `res/css/` and `res/js/` (one JS file per page). `res/js/app.js` loads on every page and builds the shared chrome (header, offcanvas menu, breadcrumb, notification center, context menus) and provides the client-side `get`/`send`/`getAndCache`/`notify`/`createDialog` helpers that call `/api/...`. Pages in the `blocked` list (`/login`, `/signup`, `/verify`, `/loading`) skip the shared chrome. UI strings are largely German.

### Packaging (`forge.config.js`)
Squirrel (Windows) and DMG (macOS) makers; GitHub publisher (draft releases); Electron Fuses harden the build (cookie encryption, ASAR-only loading, disabled Node CLI inspect). The deb/rpm/zip makers and macOS code-signing/notarization blocks are commented out. Auto-update runs via `update-electron-app` polling GitHub every 5 minutes.
