# Fortune

Run an unchanged Fortune PSP application with bundled HTMX, random-quote
refresh and offline reload. The source app is copied into an ignored fixture.

From the repository root, with Perl and cpanminus (or Carton) installed:

```sh
npm install
git clone https://github.com/aspeer/psp-WebDyne-Fortune-wasm-browser.git /tmp/webdyne-fortune-example
npm run prepare:fortune -- /tmp/webdyne-fortune-example
npm run build:fortune
npm run dev:fortune
```

Open the printed URL. Output is in `examples/fortune/dist/`. The initial
build downloads Fortune from CPAN. A ready-to-clone version and live demo
are available in [the Fortune browser repository](https://github.com/aspeer/psp-WebDyne-Fortune-wasm-browser).
