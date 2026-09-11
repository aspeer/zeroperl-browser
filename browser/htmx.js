import htmx from 'htmx.org';

// WebDyne's standard shortcut is a CDN script. The shell supplies a pinned,
// bundled instance instead, retaining the usual global API for page scripts.
export function isHtmxScript(source, base) {
  if (!source) return false;
  const url = new URL(source, base);
  return /\/htmx(?:\.min)?\.js$/.test(url.pathname) &&
    (url.origin === new URL(base).origin ||
      (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/htmx.org')) ||
      (url.hostname === 'unpkg.com' && url.pathname.startsWith('/htmx.org')));
}

export function htmxRequestUrl(path, current, shell, applicationUrl) {
  const url = new URL(path || shell, current);
  const shellUrl = new URL(shell);
  if (url.origin === shellUrl.origin && url.pathname === shellUrl.pathname) {
    return new URL(current).href;
  }
  return applicationUrl(url).href;
}

export function installHtmx({ page, currentUrl, applicationUrl }) {
  window.htmx = htmx;
  const requests = new Set();
  document.addEventListener('htmx:configRequest', event => {
    if (!page.contains(event.detail.elt)) return;
    event.detail.path = htmxRequestUrl(event.detail.path, currentUrl(), location.href, applicationUrl);
    event.detail.headers['HX-Current-URL'] = currentUrl();
  });
  document.addEventListener('htmx:beforeRequest', event => {
    if (page.contains(event.detail.elt)) requests.add(event.detail.xhr);
  });
  document.addEventListener('htmx:afterRequest', event => requests.delete(event.detail.xhr));
  return {
    beginNavigation() {
      for (const xhr of requests) xhr.abort();
      requests.clear();
    },
    clearPage() {
      // Use HTMX's public removal API so polling timers and delegated trigger
      // listeners are released before discarding the old application DOM.
      for (const child of [...page.children]) htmx.remove(child);
      page.replaceChildren();
    },
    process() { htmx.process(page); },
  };
}
