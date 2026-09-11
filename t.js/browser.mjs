import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serveSite } from '../scripts/webdyne-local.mjs';

const server = await serveSite(new URL('../examples/basic', import.meta.url).pathname, 0);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.error('BROWSER', error.message); });
page.on('console', message => { if (message.type() === 'error') console.error('CONSOLE', message.text()); });
const base = `http://127.0.0.1:${server.address().port}/dist/`;
try {
  await page.goto(base + '#/app.psp');
  await page.waitForFunction(() => document.querySelector('#visits')?.textContent.includes('1'), null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#webdyne-status').hidden);
  assert.match(await page.locator('#script-status').textContent(), /JavaScript loaded/);
  assert.equal(await page.locator('iframe').count(), 0);
  await page.click('#next');
  await page.waitForSelector('#greeting');
  assert.equal(await page.locator('#greeting').textContent(), 'Hello, Visitor');
  assert.match(page.url(), /#\/next.psp$/);
  await page.click('#home');
  await page.waitForFunction(() => document.querySelector('#visits')?.textContent.includes('2'));
  const other = await context.newPage();
  await other.goto(base + '#/app.psp');
  await other.waitForFunction(() => document.querySelector('#visits')?.textContent.includes('1'));
  assert.match(await page.locator('#visits').textContent(), /2/);
  await other.close();
  await page.fill('input[name="name"]', 'Alice & Bob');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#greeting')?.textContent === 'Hello, Alice & Bob');
  const events = await page.evaluate(() => new Promise((resolve, reject) => {
    const values = [];
    const stream = new EventSource('events.psp');
    const timeout = setTimeout(() => { stream.close(); reject(Error('SSE timeout')); }, 10000);
    stream.addEventListener('tick', event => {
      values.push(event.data);
      if (values.length === 2) { clearTimeout(timeout); stream.close(); resolve(values); }
    });
    stream.onerror = () => { clearTimeout(timeout); stream.close(); reject(Error('SSE failed')); };
  }));
  assert.deepEqual(events, ['1', '2']);
  await page.goBack();
  await page.waitForSelector('#visits');
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#visits')?.textContent.includes('1'), null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#webdyne-status').hidden);
  assert.match(await page.locator('#script-status').textContent(), /JavaScript loaded/);
  assert.deepEqual(errors, []);
  console.log('PASS: subdirectory shell, VFS assets, scripts, navigation, interpreter reuse, POST, timed SSE, history and offline reload');
} finally {
  await page.screenshot({ path: join(tmpdir(), 'webdyne-local-browser.png'), fullPage: true });
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
