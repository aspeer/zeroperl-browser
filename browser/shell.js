import { requestData, receiveResponse } from './channel.js';
import { installHtmx, isHtmxScript } from './htmx.js';

const base = new URL('./', import.meta.url);
const virtual = new URL('__webdyne_app/', base);
const worker = new Worker(new URL('perl-worker.js', base), { type: 'module' });
const page = document.getElementById('webdyne-page');
const status = document.getElementById('webdyne-status');
const baseElement = document.createElement('base');
document.head.prepend(baseElement);
let current = new URL(LOCAL_CONFIG.entry, virtual);
let navigation;
const nativeFetch = window.fetch.bind(window);
const htmxHost = installHtmx({ page, currentUrl: () => current.href, applicationUrl });

function errorMessage(error) {
  if (error.name === 'AbortError') return;
  status.hidden = false;
  status.textContent = `WebDyne: ${error.message}`;
  console.error(error);
}

function applicationUrl(value) {
  const url = new URL(value, current);
  if (url.origin !== base.origin) return url;
  if (!url.pathname.startsWith(virtual.pathname)) return new URL(url.pathname.replace(/^\//, '') + url.search + url.hash, virtual);
  return url;
}

async function dispatch(request, port) {
  const data = await requestData(request);
  const url = new URL(data.url);
  if (url.origin !== virtual.origin || !url.pathname.startsWith(virtual.pathname)) throw Error('Request is outside the local application');
  data.url = url.origin + '/' + url.pathname.slice(virtual.pathname.length) + url.search;
  const channel = port ? null : new MessageChannel();
  const response = channel && receiveResponse(channel.port1, request.signal);
  worker.postMessage({ type: 'request', request: data }, [port ?? channel.port2]);
  return response;
}

navigator.serviceWorker?.addEventListener('message', event => {
  if (event.data.type !== 'webdyne-request' || !event.ports[0]) return;
  const { request } = event.data;
  void dispatch(new Request(request.url, request), event.ports[0]).catch(error => {
    event.ports[0].postMessage({ type: 'error', message: error.message });
  });
});

async function serviceWorkerReady() {
  if (!navigator.serviceWorker) throw Error('Service workers require HTTPS or localhost');
  await navigator.serviceWorker.register(new URL('service-worker.js', base), { type: 'module', scope: base.pathname });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Service worker did not take control')), 30000);
    navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function rewriteUrls(root) {
  for (const element of root.querySelectorAll('[href], [src], [action], [poster]')) {
    for (const name of ['href', 'src', 'action', 'poster']) {
      const value = element.getAttribute(name);
      if (value?.startsWith('/') && !value.startsWith('//')) element.setAttribute(name, applicationUrl(value).href);
    }
  }
}

async function render(html, signal) {
  window.dispatchEvent(new Event('webdyne:before-render'));
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.title = parsed.title || 'WebDyne';
  document.documentElement.lang = parsed.documentElement.lang || 'en';
  rewriteUrls(parsed);
  for (const old of document.head.querySelectorAll('[data-webdyne-head]')) old.remove();
  const scripts = [...parsed.querySelectorAll('script')];
  for (const script of scripts) script.remove();
  for (const element of parsed.head.querySelectorAll('link, style, meta[name="description"]')) {
    element.setAttribute('data-webdyne-head', '');
    document.head.append(document.importNode(element, true));
  }
  htmxHost.clearPage();
  page.replaceChildren(...[...parsed.body.childNodes].map(node => document.importNode(node, true)));
  // Imported scripts are inert. Recreate them in source order, waiting for
  // external classic scripts before executing dependent inline scripts.
  for (const source of scripts) {
    if (signal.aborted) return;
    if (isHtmxScript(source.getAttribute('src'), current)) continue;
    const script = document.createElement('script');
    for (const attribute of source.attributes) script.setAttribute(attribute.name, attribute.value);
    script.textContent = source.textContent;
    script.async = false;
    const executable = !script.type || ['module', 'text/javascript', 'application/javascript'].includes(script.type);
    const loaded = executable && (script.src || script.type === 'module') ? new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(Error(`Application script failed: ${script.src || 'inline module'}`));
    }) : null;
    page.append(script);
    if (loaded) await loaded;
  }
  htmxHost.process();
  document.dispatchEvent(new CustomEvent('webdyne:render', { detail: { url: current.href, signal } }));
}

async function navigate(url, init = {}, updateHistory = true) {
  navigation?.abort();
  htmxHost.beginNavigation();
  navigation = new AbortController();
  const signal = navigation.signal;
  if (page.dataset.ready === 'true') status.hidden = true;
  let target = applicationUrl(url);
  let options = { ...init, signal };
  let response;
  for (let redirects = 0; redirects <= 10; redirects++) {
    response = await dispatch(new Request(target, options));
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects === 10) throw Error('Invalid or excessive redirect');
    const redirected = new URL(location, target);
    if (redirected.origin !== base.origin) { window.location.href = redirected.href; return; }
    target = applicationUrl(redirected);
    if (response.status === 303 || ([301, 302].includes(response.status) && options.method === 'POST')) options = { signal };
  }
  const html = await response.text();
  if (signal.aborted) return;
  if (!response.headers.get('content-type')?.includes('text/html')) throw Error('Navigation requires an HTML response');
  current = target;
  baseElement.href = current.href;
  if (updateHistory) history.pushState(null, '', base.href + '#/' + target.pathname.slice(virtual.pathname.length) + target.search + target.hash);
  await render(html, signal);
  if (signal.aborted) return;
  status.hidden = true;
  page.dataset.ready = 'true';
  window.scrollTo(0, 0);
}

document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download')) return;
  if (link.target && link.target !== '_self') return;
  const href = link.getAttribute('href');
  if (href.startsWith('#')) { event.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView(); return; }
  const target = applicationUrl(link.href);
  if (target.origin !== base.origin || !['http:', 'https:'].includes(target.protocol)) return;
  event.preventDefault();
  void navigate(target).catch(errorMessage);
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (event.defaultPrevented || (form.target && form.target !== '_self')) return;
  const target = applicationUrl(event.submitter?.getAttribute('formaction') ?? form.getAttribute('action') ?? current.href);
  if (target.origin !== base.origin) return;
  event.preventDefault();
  const method = (event.submitter?.getAttribute('formmethod') ?? form.method).toUpperCase();
  const data = new FormData(form, event.submitter);
  let body;
  if (method === 'GET') target.search = new URLSearchParams([...data].map(([key, value]) => [key, typeof value === 'string' ? value : value.name])).toString();
  else if (form.enctype === 'multipart/form-data') body = data;
  else body = new URLSearchParams([...data].map(([key, value]) => [key, typeof value === 'string' ? value : value.name]));
  void navigate(target, { method, body }).catch(errorMessage);
});

// Root-relative fetch calls cannot be intercepted by a service worker scoped
// below /repository/. Map application fetches into its virtual URL namespace.
window.fetch = (input, init) => {
  if (input instanceof Request) return nativeFetch(input, init);
  return nativeFetch(applicationUrl(input), init);
};
window.webdyneLocal = Object.freeze({ navigate, get url() { return current.href; } });
function route() { return applicationUrl(location.hash.startsWith('#/') ? location.hash.slice(1) : LOCAL_CONFIG.entry); }
window.addEventListener('hashchange', () => void navigate(route(), {}, false).catch(errorMessage));
worker.addEventListener('error', event => errorMessage(Error(event.message)));
void serviceWorkerReady().then(() => navigate(route(), {}, false)).catch(errorMessage);
