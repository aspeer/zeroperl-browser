// Request bodies are buffered; responses use one pull per chunk so a paused
// browser consumer does not accumulate an unbounded stream of worker messages.
export async function requestData(request) {
  return { url: request.url, method: request.method, headers: [...request.headers],
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer() };
}

export function receiveResponse(port, signal) {
  return new Promise((resolve, reject) => {
    let controller;
    let finished = false;
    const timeout = setTimeout(() => fail(Error('Local runtime did not return response headers within 60 seconds')), 60000);
    const close = () => { finished = true; clearTimeout(timeout); signal?.removeEventListener('abort', abort); port.close(); };
    const fail = (error) => { if (finished) return; port.postMessage({ type: 'cancel' }); controller?.error(error); reject(error); close(); };
    const abort = () => fail(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    port.onmessage = ({ data }) => {
      if (data.type === 'headers') {
        clearTimeout(timeout);
        const body = data.hasBody ? new ReadableStream({
          start(value) { controller = value; },
          pull() { port.postMessage({ type: 'pull' }); },
          cancel() { port.postMessage({ type: 'cancel' }); close(); },
        }, { highWaterMark: 0 }) : null;
        resolve(new Response(body, { status: data.status, statusText: data.statusText, headers: data.headers }));
        if (!data.hasBody) close();
      } else if (data.type === 'chunk') controller.enqueue(new Uint8Array(data.bytes));
      else if (data.type === 'end') { controller?.close(); close(); }
      else if (data.type === 'error') fail(Error(data.message));
    };
    port.onmessageerror = () => fail(Error('Invalid local response message'));
  });
}

export async function sendResponse(port, handler) {
  const abort = new AbortController();
  let reader;
  let cancelled = false;
  port.onmessage = async ({ data }) => {
    try {
      if (data.type === 'cancel') {
        cancelled = true;
        abort.abort();
        await reader?.cancel();
        port.close();
      } else if (data.type === 'pull' && reader) {
        const { value, done } = await reader.read();
        if (cancelled) return;
        if (done) { port.postMessage({ type: 'end' }); port.close(); }
        else {
          const bytes = value.slice().buffer;
          port.postMessage({ type: 'chunk', bytes }, [bytes]);
        }
      }
    } catch (error) { port.postMessage({ type: 'error', message: error.message }); port.close(); }
  };
  try {
    const response = await handler(abort.signal);
    if (cancelled) { await response.body?.cancel(); return; }
    reader = response.body?.getReader();
    port.postMessage({ type: 'headers', status: response.status, statusText: response.statusText,
      headers: [...response.headers], hasBody: !!reader });
    if (!reader) port.close();
  } catch (error) { port.postMessage({ type: 'error', message: error.message }); port.close(); }
}
