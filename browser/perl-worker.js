import { createWebDyneRuntime } from '@webdyne-runtime';
import { sendResponse } from './channel.js';

const base = new URL('./', import.meta.url);
let runtimePromise;
async function bytes(name) {
  const response = await fetch(new URL(name, base));
  if (!response.ok) throw Error(`Unable to load ${name}: ${response.status}`);
  return response.arrayBuffer();
}

function runtime() {
  runtimePromise ??= Promise.all([bytes('runtime.wasm'), bytes('app-vfs.tar.gz'), bytes('perl-lib-vfs.tar.gz')])
    .then(async ([wasm, appVfsArchive, perlLibraryVfsArchive]) => createWebDyneRuntime({
      zeroperlModule: await WebAssembly.compile(wasm), appVfsArchive, perlLibraryVfsArchive,
    }));
  return runtimePromise;
}

self.onmessage = ({ data, ports }) => {
  if (data.type !== 'request' || !ports[0]) return;
  void sendResponse(ports[0], async (signal) => {
    const host = await runtime();
    const request = new Request(data.request.url, { method: data.request.method,
      headers: data.request.headers, body: data.request.body, signal });
    const dispatch = host.dispatch(request, LOCAL_CONFIG.bindings);
    void dispatch.completion.catch(error => console.error('Local PAGI completion failed', error));
    return dispatch.response;
  });
};
