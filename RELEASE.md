# Browser package release

Package: [@webdyne/webdyne-zeroperl-browser](https://www.npmjs.com/package/@webdyne/webdyne-zeroperl-browser)
GitHub: https://github.com/aspeer/zeroperl-browser
Gitea origin: gitea@gitea.isolutions.com.au:aspeer/zeroperl-browser.git
Workflow: .github/workflows/webdyne-browser-npm.yml

## Qualification

Pull requests and pushes to main run tests, build the basic browser example,
and run Chromium. The workflow packs the npm candidate, installs that exact
archive into a fresh one-page consumer, builds htdocs, renders it, and tests
creation/update of gh-pages against a temporary local bare Git repository.
The tarball, pack metadata, source revision and SHA-256 are uploaded together.

## Staging

npm Trusted Publishing has been configured for owner aspeer, repository
zeroperl-browser, workflow webdyne-browser-npm.yml. The release workflow uses
stage-only publishing with maintainer approval.
There is no token fallback and no automatic MFA approval.

Review and merge the source to main, then dispatch the workflow on main with
stage=true. The staging job downloads only the artifact from that successful
qualification run, checks its source revision and checksum, verifies the
repository identity, attests provenance and runs npm stage publish using
npm 11.19.1. The report says awaiting approval, not published.

Review the candidate on npm and approve with MFA. Verify the resulting public
version and archive integrity afterward. The 1.0.0 release completed this staging, MFA approval and registry
verification sequence successfully.

## Current status

Version 0.1.0 is public on npm. The initial release was published manually
from the GitHub-qualified archive, and the registry archive integrity was
verified. The maintainer subsequently confirmed Trusted Publishing setup.
GitHub qualification, local packed-consumer tests and Chromium tests have
passed. Version 1.0.0 completed GitHub Trusted Publishing staging and maintainer MFA
approval, and its public registry checksum matches the qualified archive.
It includes ZeroPerl ^1.0.9 as a direct dependency.

The Fortune browser sample uses the published package and is deployed at
[GitHub Pages](https://aspeer.github.io/psp-WebDyne-Fortune-wasm-browser/).
Its automated build/deployment and live refresh/offline tests have passed.
