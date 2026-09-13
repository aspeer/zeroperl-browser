# Hello

A single PSP page evaluates `6 * 7` in Perl and displays 42.

From the repository root, after `npm install`:

```sh
node scripts/webdyne-local.mjs build --project examples/hello --output dist
node scripts/webdyne-local.mjs dev --project examples/hello --output dist
```

Open the printed URL. Static output is in `examples/hello/dist/`.
