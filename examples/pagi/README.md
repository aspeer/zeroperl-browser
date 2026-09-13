# Pagi

A standalone `app/app.pagi` returns an asynchronous PAGI coderef and sends an HTML response. It handles HTTP and lifespan scopes without a PSP template. The configured `webdyne.entry` selects the `.pagi` loader.

From the repository root, after `npm install`:

```sh
node scripts/webdyne-local.mjs build --project examples/pagi --output dist
node scripts/webdyne-local.mjs dev --project examples/pagi --output dist
```

Open the printed URL. Static output is in `examples/pagi/dist/`.
