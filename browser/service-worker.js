import { requestData, receiveResponse } from './channel.js';

const base = new URL('./', self.location.href);
const virtual = new URL('__webdyne_app/', base);
const cacheName = `webdyne-local:${base.pathname}:${CACHE_VERSION}`;
const cachedUrls = new Set(CACHE_FILES.map(name => new URL(name, base).href));
cachedUrls.add(base.href);

self.addEventListener('install', event => {
  // No skipWaiting: an updated distribution should not take over old tabs.
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...cachedUrls])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(`webdyne-local:${base.pathname}:`) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function localResponse(event) {
  const client = event.clientId && await self.clients.get(event.clientId);
  if (!client || client.type !== 'window') return new Response('Open this application through its index.html shell.', { status: 503 });
  const channel = new MessageChannel();
  const request = await requestData(event.request);
  const response = receiveResponse(channel.port1, event.request.signal);
  client.postMessage({ type: 'webdyne-request', request }, [channel.port2]);
  return response;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  url.hash = '';
  if (url.origin === virtual.origin && url.pathname.startsWith(virtual.pathname)) {
    event.respondWith(localResponse(event).catch(error => new Response(error.message, { status: 502 })));
  } else if (event.request.method === 'GET' && cachedUrls.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(event.request)) ?? fetch(event.request)));
  }
});
