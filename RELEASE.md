# Browser package release

Package: @webdyne/webdyne-zeroperl-browser
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

Configure npm Trusted Publishing for owner aspeer, repository zeroperl-browser,
workflow webdyne-browser-npm.yml. Grant stage-only permission, not direct
publication. Package ownership/initial setup may require maintainer action.
There is no token fallback and no automatic MFA approval.

Review and merge the source to main, then dispatch the workflow on main with
stage=true. The staging job downloads only the artifact from that successful
qualification run, checks its source revision and checksum, verifies the
repository identity, attests provenance and runs npm stage publish using
npm 11.19.1. The report says awaiting approval, not published.

Review the candidate on npm and approve with MFA. Verify the resulting public
version and archive integrity afterward. For the first version, validate this
end-to-end sequence before treating the release pipeline as qualified.

## Current status

The workflow is implemented and actionlint passes. Local packed-consumer,
Chromium and temporary gh-pages-remote tests pass. No workflow dispatch,
npm stage upload, npm approval, live gh-pages push or package publication has
been performed. The GitHub repository was created at the user's request;
source push/merge and npm trust setup remain separate steps.
