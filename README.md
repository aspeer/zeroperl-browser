# WebDyne Browser

Experimental static-site host for WebDyne applications using the released
ZeroPerl WASM runtime. A persistent HTML shell owns one dedicated Perl worker
per tab. Application pages render without iframes. Hash routes keep links
usable on static hosts, including sites below a GitHub Pages project path.

Published on npm as [@webdyne/webdyne-zeroperl-browser](https://www.npmjs.com/package/@webdyne/webdyne-zeroperl-browser).
This package does not modify or fork `aspeer-zeroperl`.

## Try the repository example

```sh
npm install
npm run build
npm run dev
```

Open the printed localhost URL. The first page includes an interpreter visit
counter: navigate away and back to see it increase without restarting Perl.
`dev` builds once and serves the output; rerun it after source changes.

Upload the contents of `examples/basic/dist/` to an HTTPS static host. There
is no server runtime or CDN dependency. Do not open `index.html` through
`file://`: service workers require HTTPS or localhost.

## Use in an application

Initialize your npm project and install the published package. Version 1.0.0
and later include ZeroPerl as a dependency:

```sh
npm init -y
npm install @webdyne/webdyne-zeroperl-browser
npx webdyne-browser init
npm run build
```

```json
{
  "scripts": {
    "build": "webdyne-browser build",
    "dev": "webdyne-browser dev"
  },
  "webdyne": {
    "appDirectory": "app",
    "entry": "app.psp"
  }
}
```

For an existing npm project, skip `npm init -y`. Optionally use `--save-dev`
on installation to classify the browser builder as a development dependency.
The standard runtime is installed automatically; `--runtime` remains available
for alternative runtime packages installed by the application.

The initializer creates `build`, `dev` and `gh-pages` scripts. Existing
Cloudflare build/dev commands are preserved as `build:cloudflare` and
`dev:cloudflare`; unrelated custom commands cause a clear error instead of
being overwritten.

Commands accept `--project DIR`, `--output DIR` (default `htdocs`),
`--runtime PACKAGE`, `--remote NAME` and `--port NUMBER` (default 4173). `serve` serves an
existing build. A version-specific runtime such as
`@webdyne/webdyne-zeroperl-5.44.0` can be selected with `--runtime`.

The local builder invokes the runtime's existing `webdyne-cloudflare build`
CLI in build-only mode. It consumes the resulting archives, bundles the public
`/runtime` export and stages the same WASM bytes. The complete application is
retained in the VFS, including files that `.assetsignore` would otherwise
delegate to Cloudflare's static asset server. Existing `cpanfile` and
`webdyne.perlLibrary` handling comes from that builder. Cloudflare extensions
are rejected explicitly; the browser host does not provide their bindings.

`esbuild` packages JavaScript and Perl text imports at build time.
Pinned `htmx.org` 2.0.8 is bundled into the shell for local and offline use. The runtime's
optional Node filesystem import remains external and is not executed: the
browser host supplies a compiled WASM module. The `gh-pages` dependency handles branch publication. Playwright is a test dependency.

## Runtime and navigation

```text
index.html#/next.psp
  persistent shell ── message ports ── dedicated worker
       │                                  │
       │                             existing PAGI runtime
       │                                  │
       └── service worker routing ── Perl + application VFS
```

The service worker caches the distribution and routes requests beneath
`__webdyne_app/` back to the requesting tab's worker. It never selects another
tab's interpreter. Response bodies cross the channel on demand, with binary
bytes and cancellation preserved. Request bodies are currently buffered.

The shell handles ordinary same-window links, GET/POST forms, redirects and
back/forward navigation. It sets a virtual document base for relative assets
and recreates scripts from rendered HTML in source order. Stylesheets and
application scripts can therefore be served directly from the VFS.

The startup status reads “Initializing local Perl runtime…” in a 14px system
font. Normal navigation shows no loading message and adds no delay.

Each tab has its own interpreter. Reloading starts a fresh interpreter using
cached artifacts. Offline reload works after the service worker has installed
successfully, subject to normal browser cache retention. Updates wait for old
controlled tabs to close instead of mixing new assets into their runtime.

## JavaScript lifecycle: prototype boundary

Navigation changes the application DOM, not the browser document. It does not
fire another native `DOMContentLoaded` or `load` event. Classic scripts run
again, but JavaScript globals and document/window listeners persist. Module
scripts follow normal module caching. Global lexical declarations can collide
on repeat renders; timers and listeners need cleanup. This is not transparent
compatibility with arbitrary full-page JavaScript applications.

Current hooks:

- `window` receives `webdyne:before-render` before DOM replacement.
- `document` receives `webdyne:render` after scripts run, with
  `event.detail.url` and a navigation `AbortSignal` at `event.detail.signal`.
- `window.webdyneLocal.navigate(path)` performs shell navigation.
- `window.webdyneLocal.url` returns the current virtual application URL.

The chosen contract retains the iframe-free shell with explicit lifecycle
hooks for custom JavaScript. Common HTMX requests and fragment swaps are
supported as described below; this is not a claim of full HTMX compatibility.

Additional limits: cookies and `Set-Cookie` are not a virtual cookie jar;
writes are in memory; root-relative URLs inside CSS, raw XMLHttpRequest and
preconstructed Fetch Request objects are not rewritten. Use relative URLs
under the virtual document base. Downloads, popup navigation, arbitrary
document-head/body attributes and document-writing scripts need further work.
Only HTML navigation is handled. Timed local EventSource/SSE is verified;
long-running background streams remain subject to browser lifecycle limits.
WebSockets are not implemented.

## Fortune and HTMX

From this checkout, build an isolated copy of the original Fortune application:

```sh
npm run prepare:fortune -- /path/to/psp-WebDyne-Fortune
npm run build:fortune
npm run dev:fortune
```

The preparation script copies PSP, Perl, CSS and quote database files unchanged
into an ignored example directory. It never edits the original sample. The
first build installs `Fortune` through the existing runtime CPAN pipeline.
Upload `examples/fortune/dist/` to a static host, or open localhost port 4174.

The shell bundles HTMX 2.0.8 once and exposes `window.htmx`. Known core HTMX
script references from WebDyne's jsDelivr shortcut, unpkg, or a same-origin
`htmx.js`/`htmx.min.js` are replaced by that bundled instance. Extensions and
other scripts are not suppressed. `HTMX-LICENSE.txt` ships in the output.

On each shell render, the adapter initializes new content with `htmx.process`.
Empty/current-document HTMX requests map to the current virtual PSP page;
relative and root-relative application requests use the local URL namespace.
This preserves Fortune's unchanged `hx-get=""` Refresh button. Before
navigation, outstanding HTMX requests are aborted; removing old content uses
`htmx.remove` so its timers and listeners are cleaned up.

Verified: repeated fragment refreshes, one request per click after navigation,
a stable HTMX instance, and refresh after offline reload with no CDN requests.
HTMX boost/history features, extensions and whole-body swaps are not qualified;
use ordinary shell links for full-page navigation. Custom page JavaScript still
needs the lifecycle hooks above.

## Verification

```sh
npm test
npx playwright install chromium
npm run build
npm run test:browser
```

See [TESTS.md](TESTS.md) for measured coverage and limitations. The initial
qualification used runtime 1.0.6 / Perl 5.44; the suites also pass with runtime
1.0.9. Browser qualification currently covers desktop Chromium only.

## Attribution

WebDyne and ZeroPerl runtime sources remain in their owning projects:
[WebDyne](https://github.com/aspeer/WebDyne),
[aspeer/zeroperl](https://github.com/aspeer/zeroperl), and its credited upstream
contributors. Runtime third-party notices and licenses are copied into the
static distribution. The companion host's source is licensed under MIT.

## Publishing the static site

`npm run gh-pages` builds htdocs and pushes its contents to the configured
remote's `gh-pages` branch. It uses the standard `gh-pages` npm package with
history preserved and dotfiles included. It leaves the source checkout on
its current branch. The default remote is `origin`; configure another with
`--remote github` in the generated script if origin is Gitea. GitHub Pages
should be configured for branch `gh-pages`, directory `/`. No live push is
performed by `init`, `build` or `dev`.

Builds use a staging directory and replace only an owned output directory.
A failed build preserves the previous site; a successful build discards stale
output files. Keep hand-maintained files in the application tree, not htdocs.

## Package release

See [RELEASE.md](RELEASE.md) for GitHub Actions and npm stage-only Trusted
Publishing setup. The workflow qualifies the packed tarball in a fresh
consumer, including a real browser and a temporary local gh-pages remote.
The same artifact is submitted to npm staging only on an explicit main-branch
workflow dispatch with staging enabled. Maintainer MFA approval stays manual.
