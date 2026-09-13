# Basic

PSP pages demonstrate links, form POST, CSS/JavaScript assets and a per-tab visit counter. `app/events.psp` also exposes a two-event SSE stream.

From the repository root, after `npm install`:

```sh
node scripts/webdyne-local.mjs build --project examples/basic --output dist
node scripts/webdyne-local.mjs dev --project examples/basic --output dist
```

Open the printed URL. Static output is in `examples/basic/dist/`.

To try SSE, open `#/events.psp` and run this in the browser console:

```js
const events = new EventSource(new URL('events.psp', document.baseURI));
events.addEventListener('tick', event => {
  console.log(event.data);
  if (event.data === '2') events.close();
});
```

It prints two ticks, then closes the connection.
