# Changes

## 0.1.0

- Add static build/serve CLI around the existing runtime archive builder.
- Add persistent dedicated Perl worker, service worker cache/request routing,
  iframe-free HTML shell and hash navigation.
- Preserve binary responses and stream cancellation over message channels.
- Add native Perl and Chromium checks including timed SSE and offline reload.
- Document JavaScript lifecycle limitations; retain the iframe-free contract.
- Bundle pinned HTMX with request mapping, initialization and cleanup.
- Qualify unchanged Fortune refreshes, navigation and offline reload without
  CDN requests.

- Rename the distribution to @webdyne/webdyne-zeroperl-browser.
- Add init and gh-pages commands, htdocs defaults and safe output replacement.
- Qualify a packed install in both a one-page consumer and fresh Gitea Fortune clone.
- Add GitHub qualification and stage-only npm workflow.
