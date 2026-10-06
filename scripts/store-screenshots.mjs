import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {STORE_DEVICES, STORE_SCREENS, pngToOpaqueRgb} from './store-screenshot-png.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.MAEUM_SCREENSHOT_PORT || 4177);
const origin = 'http://127.0.0.1:' + port;
const JOURNAL = {
  context: '창가에 앉아 잠깐',
  note: '다른 생각을 하던 나를 알아차렸고, 숨의 온도로 주의를 돌려봤다. 와인이 없어도 이 감각이면 충분했다.',
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: 'inherit'});
    child.on('exit', code => code === 0 ? resolve() : reject(Error(command + ' ' + args.join(' ') + ' exited ' + code)));
    child.on('error', reject);
  });
}

async function waitForPreview() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin + '/preview/');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw Error('preview server did not become ready on ' + origin);
}

function startPreview() {
  const child = spawn(process.execPath, ['scripts/dev.mjs', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  return child;
}

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.summer-hero, .player, .editor, .journal, .community-feed, .public-record, .public-profile, .settings-page, .account'));
  await page.waitForFunction(() => !document.querySelector('p.loading')?.textContent?.includes('불러오고'));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(['Gowun Batang', 'Gowun Dodum', 'Nanum Gothic'].map(family => document.fonts.load('16px "' + family + '"')));
    await Promise.all([...document.images].map(img => img.complete && img.naturalWidth ? null : new Promise(resolve => {
      img.addEventListener('load', resolve, {once: true});
      img.addEventListener('error', resolve, {once: true});
    })));
  });
}

async function hideChrome(page) {
  if (await page.locator('dialog[open]').count()) await page.click('dialog [data-action="close"]');
  await page.addStyleTag({content: ':root{--sans:"Nanum Gothic","Noto Sans KR",sans-serif}.toast,.toast.visible{display:none!important;opacity:0!important}'});
  await page.evaluate(() => {
    const toast = document.querySelector('.toast');
    if (toast) {
      toast.classList.remove('visible');
      toast.textContent = '';
    }
    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = node.textContent
          .replace(/preview@example\.test/g, '로그인됨')
          .replace(/reviewer@example\.test/g, '로그인됨');
      } else {
        for (const child of node.childNodes) walk(child);
      }
    };
    walk(document.body);
    document.activeElement?.blur?.();
  });
}

async function assertStoreClean(page, name) {
  const problems = await page.evaluate(() => {
    const issues = [];
    if (document.querySelector('dialog[open]')) issues.push('open dialog overlay');
    if (document.querySelector('.toast.visible')) issues.push('toast');
    const text = document.body.innerText || '';
    if (/불러오고|미리보기:|preview@example\.test|reviewer@example\.test/.test(text)) issues.push('loading or preview-only copy');
    if (/이 기록을 신고하기|이 계정을 차단할까요|안전 안내를 전해요|댓글을 지울까요/.test(text)) issues.push('modal copy on a dimmed overlay');
    return issues;
  });
  if (problems.length) throw Error(name + ' is not store-clean: ' + problems.join(', '));
}

async function openApp(page) {
  await page.goto(origin + '/preview/', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.body.dataset.view === 'home' && document.querySelector('.summer-hero'));
  await page.waitForFunction(() => {
    const feed = document.querySelector('#home-feed');
    return feed && !/불러오고/.test(feed.textContent || '');
  });
  await ready(page);
}

async function clickVisible(page, selector) {
  await page.locator(selector).locator('visible=true').first().click();
}

async function clickAction(page, action, extra = '') {
  await clickVisible(page, `[data-action="${action}"]${extra}`);
}

async function prepareToday(page) {
  await ready(page);
  await page.waitForFunction(() => document.querySelectorAll('.recent-moments .moment-card').length >= 2);
  await page.waitForFunction(() => !/불러오지 못했어요/.test(document.querySelector('.recent-moments')?.innerText || ''));
}

async function preparePractice(page) {
  await clickAction(page, 'start');
  await page.waitForSelector('.player');
  const voice = page.locator('#voice-control');
  if (await voice.count() && await voice.getAttribute('aria-pressed') === 'true') await voice.click();
  await clickAction(page, 'pause');
  await page.waitForFunction(() => document.querySelector('#pause-control')?.textContent === '이어가기');
  await ready(page);
}

async function prepareJournal(page) {
  if (await page.locator('dialog[open]').count()) await page.click('dialog [data-action="close"]');
  if (await page.locator('.player').count()) await page.click('.brand[data-action="home"]');
  await page.waitForSelector('.summer-hero, .home');
  await clickAction(page, 'write');
  await page.waitForSelector('#record-form');
  await page.fill('#record-form [name="context"]', JOURNAL.context);
  await page.fill('#record-form [name="wineName"]', '');
  await page.fill('#record-form [name="vintage"]', '');
  await page.fill('#record-form [name="note"]', JOURNAL.note);
  await page.waitForFunction(() => document.querySelector('#draft-status')?.dataset.state === 'saved' || document.querySelector('#draft-status')?.textContent?.includes('보관'));
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('.editor h1')?.scrollIntoView({block: 'start'});
    document.activeElement?.blur?.();
  });
  await ready(page);
}

async function prepareLibrary(page) {
  await clickAction(page, 'journal');
  await page.waitForSelector('.journal .moment-card, .journal .diary-row');
  await page.waitForFunction(() => /공개/.test(document.querySelector('.journal')?.innerText || '') && /나만/.test(document.querySelector('.journal')?.innerText || ''));
  await ready(page);
}

async function prepareCommunity(page) {
  if (await page.locator('dialog[open]').count()) await page.click('dialog [data-action="close"]');
  await clickAction(page, 'together');
  await page.waitForSelector('.community-feed');
  await page.waitForSelector('text=수연');
  const suyeonPost = page.locator('.review-card:has-text("수연"), .community-feed .moment-card:has-text("비 그친 오후")').first();
  await suyeonPost.click();
  await page.waitForSelector('.public-record');
  await page.waitForSelector('[data-social-action="report-preview"]');
  await page.waitForSelector('.cloud-comment');
  await ready(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('[data-social-action="report-preview"]')?.scrollIntoView({block: 'nearest'});
    document.activeElement?.blur?.();
  });
  const reportBox = await page.locator('[data-social-action="report-preview"]').boundingBox();
  if (!reportBox || reportBox.y + reportBox.height < 0 || reportBox.y > page.viewportSize().height) {
    throw Error('community 신고 control is not in the viewport');
  }
}

async function prepareSettings(page) {
  if (await page.locator('dialog[open]').count()) await page.click('dialog [data-action="close"]');
  await clickAction(page, 'home');
  await page.waitForSelector('.summer-hero');
  await page.click('header [data-cloud-action="account"]');
  await page.waitForSelector('.account, .settings-page');
  if (await page.locator('[data-action="settings"]').count()) {
    await clickAction(page, 'settings');
  }
  await page.waitForSelector('.settings-page [data-action="safety-notice"]');
  await hideChrome(page);
  await ready(page);
  await page.evaluate(() => {
    const row = document.querySelector('.settings-policies');
    if (row) {
      const top = row.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - 24));
    }
    document.activeElement?.blur?.();
  });
}

const prepare = {
  today: prepareToday,
  practice: preparePractice,
  journal: prepareJournal,
  library: prepareLibrary,
  community: prepareCommunity,
  settings: prepareSettings,
};

async function captureDevice(browser, device) {
  await mkdir(device.dir, {recursive: true});
  const preview = startPreview();
  try {
    await waitForPreview();
    const context = await browser.newContext({
      viewport: {width: device.cssWidth, height: device.cssHeight},
      deviceScaleFactor: device.scale,
      colorScheme: 'light',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
      hasTouch: true,
      isMobile: device.id.startsWith('iphone'),
    });
    await context.addInitScript(() => {
      localStorage.setItem('maeum-gyeol:safety-v1', JSON.stringify({crisisNotice: true}));
      const speak = function speak(utterance) {
        queueMicrotask(() => utterance.onend?.());
      };
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {speak, cancel() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {}},
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await openApp(page);
    for (const screen of STORE_SCREENS) {
      await prepare[screen.name](page);
      await hideChrome(page);
      await assertStoreClean(page, device.id + '/' + screen.file);
      await new Promise(resolve => setTimeout(resolve, 160));
      const png = pngToOpaqueRgb(await page.screenshot({type: 'png', animations: 'disabled', caret: 'hide'}));
      await writeFile(device.dir + '/' + screen.file, png);
      console.log('wrote', device.dir + '/' + screen.file);
    }
    await context.close();
  } finally {
    preview.kill('SIGTERM');
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        preview.kill('SIGKILL');
        resolve();
      }, 2000);
      preview.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  await run('npm', ['--prefix', 'mobile', 'run', 'build']);
  for (const device of STORE_DEVICES) await captureDevice(browser, device);
} finally {
  await browser.close();
}
