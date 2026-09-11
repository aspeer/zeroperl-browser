import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serveSite } from '../scripts/webdyne-local.mjs';

const server = await serveSite(process.env.FORTUNE_PROJECT ?? new URL('../examples/fortune', import.meta.url).pathname, 0);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const base = `http://127.0.0.1:${server.address().port}/${process.env.FORTUNE_OUTPUT ?? 'dist'}/`;
const errors = [];
const remote = [];
page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
await context.route('**/*', async route => {
  if (new URL(route.request().url()).origin !== new URL(base).origin) {
    remote.push(route.request().url());
    return route.abort();
  }
  return route.continue();
});
async function refresh() {
  const result = page.evaluate(() => new Promise((resolve, reject) => {
    let requests = 0;
    const count = () => requests++;
    document.addEventListener('htmx:beforeRequest', count);
    const timer = setTimeout(() => reject(Error('Fortune refresh timed out')), 10000);
    document.addEventListener('htmx:afterSwap', event => {
      clearTimeout(timer);
      document.removeEventListener('htmx:beforeRequest', count);
      resolve({ requests, path: event.detail.requestConfig.path, text: document.querySelector('#fortune').textContent.trim() });
    }, { once: true });
    document.querySelector('button[hx-get]').click();
  }));
  const { path, text, requests } = await result;
  assert.equal(requests, 1, 'one request per refresh after repeated navigation');
  assert.equal(new URL(path).pathname, new URL('__webdyne_app/app.psp', base).pathname);
  assert.ok(text.length > 0);
  assert.equal(await page.locator('#fortune').count(), 1);
  return text;
}
try {
  await page.goto(base + '#/app.psp');
  await page.waitForSelector('#fortune', { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#webdyne-status').hidden);
  assert.equal(await page.evaluate(() => htmx.version), '2.0.8');
  await page.evaluate(() => { window.savedHtmx = htmx; });
  const quotes = new Set();
  for (let i = 0; i < 5; i++) quotes.add(await refresh());
  assert.ok(quotes.size > 1, 'Refresh produces different fortunes');
  await page.evaluate(() => webdyneLocal.navigate('app.psp?navigation=again'));
  await page.waitForSelector('#fortune');
  await page.evaluate(() => webdyneLocal.navigate('app.psp'));
  await page.waitForSelector('#fortune');
  assert.equal(await page.evaluate(() => savedHtmx === htmx), true);
  await refresh();
  await context.setOffline(true);
  await refresh();
  await page.reload();
  await page.waitForSelector('#fortune', { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#webdyne-status').hidden);
  await refresh();
  assert.deepEqual(remote, []);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('iframe').count(), 0);
  console.log('PASS: unchanged Fortune, HTMX refresh, singleton/reinitialization, offline refresh/reload, no CDN requests');
} finally {
  await page.screenshot({ path: join(tmpdir(), 'webdyne-local-fortune.png'), fullPage: true });
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
