# Browser host implementation

- [x] Build static output using the existing runtime and VFS builder.
- [x] Keep one dedicated Perl worker behind an iframe-free hash shell.
- [x] Route assets and Fetch requests through a service worker.
- [x] Verify navigation, forms, scripts, streams, offline reload and subdirectory hosting.
- [x] Document compatibility boundaries and package the initial implementation.

No upstream runtime edits, deployment or publication are planned.

The user selected the iframe-free shell with focused HTMX support.

- [x] Bundle pinned HTMX and initialize it once per shell.
- [x] Route current-page HTMX requests to the virtual PSP page.
- [x] Run unchanged Fortune sources through repeated refresh and offline tests.

## Consumer and release milestone

- [x] Install the packed browser package in a fresh Gitea Fortune clone.
- [x] Initialize build/dev/gh-pages scripts and build htdocs.
- [x] Verify gh-pages against a local bare remote without publishing live.
- [x] Add GitHub qualification and npm staging workflow.
- [x] Record external repository and npm Trusted Publishing setup requirements.
