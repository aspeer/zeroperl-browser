# Verification

Initial run: 2026-09-11, macOS arm64, Node 26.8.1,
`@webdyne/webdyne-zeroperl` 1.0.6 (Perl 5.44), Playwright Chromium 153.

- `npm run build`: passes, using the unmodified installed runtime package.
- `npm test`: eight tests cover binary/status/header transport, null bodies,
  producer errors, cancellation and CLI/path checks.
- `npm run test:browser`: serves the example under `/dist/`, exercises PSP
  rendering, CSS/JavaScript loaded from the VFS, iframe absence, navigation,
  warm interpreter counter, independent tabs, form POST, browser history,
  two timed events through native EventSource, and offline reload from cache.
- `WEBDYNE_SOURCE=/path/to/pm-WebDyne prove t/native-render.t`: seven native
  assertions pass. Runs wdlint on all three PSP files and wdrender on normal
  and parameterized pages. Native output warns about optional HTML::Tidy5 and
  a wide-character diagnostic; assertions and exit codes pass.
- `npm pack --dry-run`: passes. Runtime binaries and generated examples are
  not accidentally included in the companion npm package.

The browser test requires `npx playwright install chromium`. This session used
`PLAYWRIGHT_BROWSERS_PATH=/private/tmp/webdyne-local-browsers` to keep downloaded
browsers in temporary storage. It writes a final screenshot in the operating system temporary directory.

Not qualified: Safari/Firefox/mobile, actual GitHub Pages deployment,
long-lived/background SSE, service-worker updates across releases, general
HTMX boost/history/extensions, uploads/downloads, virtual cookies, persistent
storage, WebSockets, arbitrary full-document JavaScript compatibility.

`npm audit` reports four high-severity dependency entries along the existing
runtime -> Wrangler -> Miniflare -> sharp chain (GHSA-rgj7-g3m4-5g8c). These
are inherited development/build tooling, not bundled into the browser host.
No automatic fix is available for the pinned runtime. No upstream runtime
source or dependency configuration was changed to address this here.

## Fortune integration

`npm run prepare:fortune -- /path/to/psp-WebDyne-Fortune`, followed by
`npm run build:fortune` and `npm run test:fortune`, checks the original
application in a copied fixture. The generated application tree is ignored by
git. Fortune 0.2 is installed from CPAN by the upstream builder.

Desktop Chromium passes initial rendering, five random-quote refreshes,
repeated full shell navigation, singleton HTMX identity, one
request per refresh, offline refresh and offline reload. External requests
are blocked and asserted absent, and no iframe or browser exception occurs.
Screenshots are written to the operating system temporary directory.

## Packed consumer and branch deployment

The fresh clone at psp-WebDyne-Fortune-Browser was made from the supplied
Gitea URL on branch codex/static-browser-build. The actual npm archive was
installed; `webdyne-browser init` and `npm run build` produced htdocs with
runtime 1.0.7, and the unchanged Fortune application passed the Chromium
refresh/navigation/offline suite.

`node t.js/packed.mjs PACKAGE.tgz` independently creates a temporary consumer
with just app/app.psp and package metadata, installs the archive with runtime
1.0.6, invokes its npm-installed executable, builds htdocs and renders Perl 42.
It verifies stale-file removal and failed-build preservation. It publishes
twice to a temporary local bare Git remote and verifies gh-pages content,
parent history, .nojekyll, and preservation of the source branch and HEAD.
No live Gitea/GitHub gh-pages push was performed.

`actionlint .github/workflows/webdyne-browser-npm.yml` passes locally. Actual
GitHub workflow execution, npm Trusted Publishing and npm staging remain
external release qualification steps.
