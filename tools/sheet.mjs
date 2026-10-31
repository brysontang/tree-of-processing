// Lays a grown tree out on one page, a row per level, each sketch with its score and how it was made, so a run can be
// looked over at a glance. Writes sheet.html and sheet.png to the run's folder. Only the screenshots are shown: no
// sketch code runs.
//
// CLI: node tools/sheet.mjs [run folder]   (the latest run in output/ if none is given)

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const METHODS = {
  root: 'root',
  'adding a unique idea to the script': 'idea',
  'refactoring the code and expand the functionality': 'expand',
  'adding recursion to the code': 'recursion',
  'reimagining the code': 'reimagine',
};

const latestRun = () => {
  const saved = (dir) => path.join(dir, 'tree.json');
  const runs = fs.existsSync('output')
    ? fs.readdirSync('output').map((dir) => path.join('output', dir)).filter((dir) => fs.existsSync(saved(dir)))
    : [];
  return runs.sort((a, b) => fs.statSync(saved(b)).mtimeMs - fs.statSync(saved(a)).mtimeMs)[0];
};

const dir = process.argv[2] ?? latestRun();
if (!dir) {
  console.log('There are no saved trees in output/ yet');
  process.exit(1);
}
const tree = JSON.parse(fs.readFileSync(path.join(dir, 'tree.json'), 'utf8'));

const levels = [];
const walk = (leaf, parent) => {
  (levels[leaf.depth] ??= []).push({ leaf, parent });
  leaf.children.forEach((child) => walk(child, leaf));
};
walk(tree.root, null);

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const cell = ({ leaf, parent }) => {
  const problems = leaf.problems ?? [];
  const notes = [
    leaf.retried && 'rewritten twice',
    leaf.same && 'looks the same',
    leaf.repair && !problems.length && 'repaired',
  ].filter(Boolean);
  const picture = problems.length
    ? `<div class="down" title="${escape(problems.join('\n'))}">turned down</div>`
    : `<img src="${escape(`${leaf.hash}_${leaf.method.replace(/\s/g, '')}.png`)}" alt="">`;
  const label = `${leaf.score < 0 ? '' : `<b>${leaf.score}</b> `}${escape(METHODS[leaf.method] ?? leaf.method)}`;
  const from = parent ? ` of ${parent.hash.slice(0, 4)}` : '';
  const small = [leaf.hash.slice(0, 4), ...notes].join(' · ');
  return `<td>${picture}${label}${from}<br><small>${small}</small></td>`;
};

const html = `<!doctype html>
<meta charset="utf-8">
<title>${escape(tree.root.prompt)}</title>
<style>
  body { margin: 16px; background: #666; color: #fff; font: 13px/1.4 sans-serif; }
  h1 { font-size: 18px; }
  th { padding-right: 8px; font-size: 20px; vertical-align: top; }
  td { padding: 4px; text-align: center; vertical-align: top; }
  img, .down { display: block; width: 200px; height: 200px; margin-bottom: 4px; }
  .down { background: #400; line-height: 200px; }
</style>
<h1>${escape(tree.root.prompt)}</h1>
${levels.map((row, depth) => `<table><tr><th>${depth}</th>${row.map(cell).join('')}</tr></table>`).join('\n')}
`;
const page = path.join(dir, 'sheet.html');
fs.writeFileSync(page, html);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const tab = await browser.newPage();
  const widest = Math.max(...levels.map((row) => row.length));
  await tab.setViewport({ width: Math.max(800, widest * 208 + 80), height: 100 });
  await tab.goto(`file://${path.resolve(page)}`, { waitUntil: 'load' });
  await tab.screenshot({ path: path.join(dir, 'sheet.png'), fullPage: true });
} finally {
  await browser.close();
}
console.log(`${page} and sheet.png`);
