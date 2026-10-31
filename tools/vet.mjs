// Copied from ../generative_art/tools/vet.mjs, the gallery's vetting; keep the two in step. One difference: here the
// dry run serves the p5 script from vendor/ instead of fetching it, so vetting needs no internet.
// Vets untrusted p5.js code before it can join the gallery. Two passes:
//
// 1. Static: parse with acorn and reject anything that touches the network, storage,
//    navigation, other windows, devices or dynamic code, or that smuggles in markup.
//    This catches code paths a dry run never reaches (a fetch inside mousePressed).
// 2. Dry run: render it in headless Chrome inside the same sandbox the gallery uses
//    (js/sandbox.js), aborting every request except the p5 script. Rejects on network
//    or CSP violations, dialogs, popups, navigation, uncaught errors, freezes, very low
//    frame rates and blank canvases.
//
// Static checks can be obfuscated around (computed property names, etc.), so neither
// pass is the guarantee: the sandbox the gallery renders in is what contains the code.
// Code that fails the static pass is never executed.
//
// CLI: node tools/vet.mjs <file.js> [--shot out.png]

import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_LENGTH = 30000;

// Local copies of the scripts the sandbox loads, by URL. p5-1.11.3.min.js matches cdnjs's published sha512 and npm's
// p5@1.11.3 lib/p5.min.js byte for byte.
const COPIES = {
  'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js': 'vendor/p5-1.11.3.min.js',
};

// Free (undeclared) identifiers. A name the sketch declares itself, like `let history = []`, is its own.
const GLOBALS = group({
  'network access': ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'RTCPeerConnection', 'WebTransport', 'Image', 'Audio', 'importScripts'],
  'external files': ['loadImage', 'loadJSON', 'loadStrings', 'loadTable', 'loadXML', 'loadBytes', 'loadFont', 'loadModel', 'loadShader', 'loadSound', 'httpGet', 'httpPost', 'httpDo', 'createImg', 'createVideo', 'createAudio', 'createA'],
  'dynamic code': ['eval', 'Function', 'WebAssembly', 'Worker', 'SharedWorker', 'atob'],
  'page access': ['window', 'self', 'globalThis', 'document', 'parent', 'top', 'opener', 'frames', 'frameElement', 'location', 'history', 'open', 'postMessage'],
  dialogs: ['alert', 'confirm', 'prompt'],
  storage: ['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'storeItem', 'getItem', 'removeItem', 'clearStorage'],
  'device access': ['navigator', 'createCapture', 'Notification'],
});

// Property names that are dangerous on any object (x.constructor, x['cookie'], ...).
const PROPERTIES = group({
  'prototype escape': ['constructor', '__proto__', '__defineGetter__', '__defineSetter__', '__lookupGetter__'],
  'markup injection': ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'srcdoc', 'html'],
  'page access': ['contentWindow', 'contentDocument', 'opener', 'postMessage', 'cookie'],
  'network access': ['sendBeacon'],
  storage: ['localStorage', 'sessionStorage', 'indexedDB'],
  'device access': ['mediaDevices', 'getUserMedia', 'geolocation', 'clipboard', 'serviceWorker'],
});

// The one read from `window` sketches need: capping pixelDensity at the screen's density. Allowed only as a
// direct `window.devicePixelRatio`, so the sketch never holds a reference to `window` itself.
const WINDOW_READS = new Set(['devicePixelRatio']);

const SAFE_TAGS = new Set(['div', 'span', 'p', 'button', 'input', 'label', 'select', 'option', 'canvas', 'br', 'h1', 'h2', 'h3']);
const URL_PATTERN = /\b(?:https?|wss?|ftp|javascript):|\bdata:text\/html/i;

function group(byReason) {
  const map = new Map();
  for (const [reason, names] of Object.entries(byReason)) for (const n of names) map.set(n, reason);
  return map;
}

/** Static pass. Returns { ok, issues: [{ line, reason, detail }] }. */
export function scan(code) {
  const issues = [];
  const flag = (node, reason, detail) => issues.push({ line: node.loc?.start.line ?? 0, reason, detail });

  if (code.length > MAX_LENGTH) {
    return { ok: false, issues: [{ line: 0, reason: 'too long', detail: `${code.length} characters (max ${MAX_LENGTH})` }] };
  }
  let ast;
  try {
    ast = parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  } catch (err) {
    return { ok: false, issues: [{ line: err.loc?.line ?? 0, reason: 'not valid JavaScript', detail: err.message }] };
  }

  // acorn-walk visits declared/assigned names as VariablePattern and references as Identifier.
  const declared = new Set();
  const references = [];
  const allowed = new Set(); // `window` identifiers that only read an allowed property
  const propertyName = (node) =>
    !node.computed ? node.property.name : node.property.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : null;
  const calleeName = (callee) =>
    callee.type === 'Identifier' ? callee.name : callee.type === 'MemberExpression' ? propertyName(callee) : null;
  const isStringy = (node) =>
    node && ((node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral');

  simple(ast, {
    VariablePattern(node) {
      declared.add(node.name);
    },
    Identifier(node) {
      references.push(node);
    },
    MemberExpression(node) {
      const name = propertyName(node);
      if (name && PROPERTIES.has(name)) flag(node, PROPERTIES.get(name), `.${name}`);
      if (node.object.type === 'Identifier' && node.object.name === 'window' && !node.computed && WINDOW_READS.has(name)) {
        allowed.add(node.object);
      }
    },
    CallExpression(node) {
      const name = calleeName(node.callee);
      const [first] = node.arguments;
      if ((name === 'setTimeout' || name === 'setInterval') && isStringy(first)) {
        flag(node, 'dynamic code', `${name} with a string`);
      }
      if (name === 'createElement') {
        const tag = first?.type === 'Literal' ? String(first.value).toLowerCase() : null;
        if (!SAFE_TAGS.has(tag)) flag(node, 'markup injection', `createElement(${tag ?? 'computed tag'})`);
      }
      if (name === 'setAttribute' || name === 'attribute') {
        const attr = first?.type === 'Literal' ? String(first.value).toLowerCase() : null;
        if (attr === null || attr.startsWith('on') || attr === 'src' || attr === 'href') {
          flag(node, 'markup injection', `${name}(${attr ?? 'computed name'})`);
        }
      }
    },
    ImportExpression(node) {
      flag(node, 'dynamic code', 'import()');
    },
    Literal(node) {
      if (typeof node.value === 'string' && URL_PATTERN.test(node.value)) flag(node, 'external URL', node.value.slice(0, 80));
    },
    TemplateElement(node) {
      if (URL_PATTERN.test(node.value.cooked ?? '')) flag(node, 'external URL', node.value.raw.slice(0, 80));
    },
  });

  for (const node of references) {
    if (GLOBALS.has(node.name) && !declared.has(node.name) && !allowed.has(node)) flag(node, GLOBALS.get(node.name), node.name);
  }
  issues.sort((a, b) => a.line - b.line);
  return { ok: issues.length === 0, issues };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeout = (promise, ms) =>
  Promise.race([promise, sleep(ms).then(() => Promise.reject(new Error('timeout')))]);

/** Dry-run pass in headless Chrome. Returns { ok, problems, stats }. */
export async function dryRun(code, { seed = 1, seconds = 6, screenshot } = {}) {
  const problems = [];
  const stats = {};
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 640 });

    const harness = pathToFileURL(path.join(ROOT, 'tools/vet-harness.html')).href;
    const local = pathToFileURL(ROOT).href;
    let p5Url = null;
    let p5Copy = null;
    const blocked = [];
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      // The sandbox loads p5 with crossorigin="anonymous", so it needs the CORS header cdnjs sends.
      if (url === p5Url) {
        return req.respond({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          headers: { 'access-control-allow-origin': '*' },
          body: p5Copy,
        });
      }
      if (url.startsWith(local) || /^(data|blob):/.test(url)) return req.continue();
      blocked.push(url);
      req.abort();
    });
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    page.on('dialog', (d) => {
      problems.push(`opened a dialog: ${d.message()}`);
      d.dismiss();
    });
    browser.on('targetcreated', (t) => t.type() === 'page' && problems.push(`opened a window: ${t.url()}`));
    page.on('framenavigated', (f) => {
      if (f !== page.mainFrame() && f.url() !== 'about:srcdoc') problems.push(`navigated to ${f.url()}`);
    });

    await page.goto(harness, { waitUntil: 'load' });
    p5Url = await page.evaluate(() => Sandbox.P5_URL);
    if (!COPIES[p5Url]) throw new Error(`No local copy of ${p5Url}: download it to vendor/ and add it to COPIES`);
    p5Copy = fs.readFileSync(path.join(ROOT, COPIES[p5Url]));
    await page.evaluate((c, s) => run(c, s), code, seed);
    // Look at the canvas every 250 ms through the last 1.25 s, so "blank" means nothing showed in that time, not
    // that it was empty at the one moment we looked. The window matches the simulated visitor's 1.2 s click
    // interval: a sketch that only draws in response to clicks (Command A's circles flash for half a second)
    // shows something in it, while one that has washed out to a flat colour (GPT-5.5's additive fade, solid
    // from about 4.25 s) doesn't.
    const started = Date.now();
    await sleep(seconds * 1000 - 1250);
    while (Date.now() - started < seconds * 1000) {
      await timeout(page.evaluate(() => handle.command('probe')), 3000).catch(() => {});
      await sleep(250);
    }

    let events;
    try {
      await timeout(page.evaluate(() => handle.command('probe')), 3000);
      await sleep(400);
      events = await timeout(page.evaluate(() => events), 3000);
    } catch {
      problems.push('froze the page');
      return { ok: false, problems, stats };
    }
    if (screenshot) await timeout(page.screenshot({ path: screenshot }), 5000).catch(() => {});

    const ticks = events.filter((e) => e.type === 'tick');
    const probes = events.filter((e) => e.type === 'probe' && e.canvas);
    const probe = probes.reduce((best, p) => (p.colors > best.colors ? p : best), probes[0] ?? { canvas: false });
    const last = ticks.at(-1);
    const first = ticks.find((t) => t.t > 1000) ?? ticks[0];
    stats.fps = last && first && last.t > first.t ? Math.round(((last.frames - first.frames) / (last.t - first.t)) * 1000) : 0;
    stats.canvas = probe?.canvas ? `${probe.width}×${probe.height}` : null;
    stats.colors = probe?.colors ?? 0;

    for (const url of blocked) problems.push(`tried to load ${url}`);
    for (const e of events.filter((e) => e.type === 'csp')) problems.push(`blocked by the sandbox: ${e.directive} ${e.blocked}`);
    // p5 registers device-motion listeners on startup, which the sandbox denies. That's p5, not the sketch.
    const P5_NOISE = /Content Security Policy|Permissions policy violation: (accelerometer|gyroscope|magnetometer)/;
    const errors = events.filter((e) => e.type === 'error').map((e) => e.message);
    for (const m of consoleErrors) {
      if (!P5_NOISE.test(m) && !errors.some((e) => m.includes(e))) errors.push(m);
    }
    for (const message of new Set(errors)) problems.push(`error: ${message}`);
    if (!last || last.t < seconds * 1000 - 1500) problems.push('stopped responding');
    else if (stats.fps < 10) problems.push(`too slow (${stats.fps} fps)`);
    if (!probe?.canvas) problems.push('drew no canvas');
    else if (probe.colors < 2) problems.push('canvas is blank');
  } finally {
    await browser.close();
  }
  return { ok: problems.length === 0, problems, stats };
}

/** Both passes; the dry run only happens if the static pass is clean. */
export async function vet(code, options) {
  const stat = scan(code);
  if (!stat.ok) return { ok: false, static: stat, run: null };
  const run = await dryRun(code, options);
  return { ok: run.ok, static: stat, run };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { readFile } = await import('node:fs/promises');
  const [file, flag, shot] = process.argv.slice(2);
  if (!file) {
    console.error('usage: node tools/vet.mjs <file.js> [--shot out.png]');
    process.exit(2);
  }
  const report = await vet(await readFile(file, 'utf8'), { screenshot: flag === '--shot' ? shot : undefined });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
