# Decisions

## Browser package owns hosting, not Perl runtime changes

Use the public runtime export and invoke the shipped build CLI. Pin and test
the package version; do not copy the interpreter, PAGI runner or VFS builder.

## Persistent shell with hash routes

The top-level document owns a dedicated worker. Application documents render
inside its main element without an iframe. A service worker routes virtual
URLs and caches the static distribution, but does not own the interpreter.
Each tab has independent Perl memory. Reloads start a fresh interpreter.

## Retain PAGI

Use the existing dispatch/response/completion boundary. Carry response streams
over message ports with pull-based backpressure and cancellation.

## HTMX support in the iframe-free shell (2026-09-11)

The user selected focused HTMX integration. Bundle one pinned HTMX 2.0.8
instance in the companion shell, replace recognized core CDN script tags,
and map configRequest paths to the virtual page. Use public process/remove
APIs and abort pending requests during shell navigation. No upstream runtime
or Fortune page edits are required. General JavaScript document lifecycle
compatibility remains explicitly outside this mode.

## Browser distribution and release workflow

Use @webdyne/webdyne-zeroperl-browser and webdyne-browser as public names,
retaining webdyne-local as a compatibility executable. Default consumer output
is htdocs. Gitea origin is aspeer/zeroperl-browser; GitHub mirror is
aspeer/zeroperl-browser. The npm workflow uses staged Trusted Publishing with
manual MFA approval, following the existing runtime release model.

Use gh-pages rather than custom Git branch manipulation. Publish only after a
successful build; preserve history and source checkout state.
