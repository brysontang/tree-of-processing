import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import * as readline from 'node:readline';

import { Tree } from './entities/tree';
import { Leaf } from './entities/leaf';
import { output } from './scripts/processing';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Each run gets a folder of its own in output/, for its screenshots and its tree.json.
const newRunDir = (prompt: string) => {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return path.join('output', `${slug}-${stamp}`);
};

const latestTree = () => {
  const saved = fs.existsSync('output')
    ? fs.readdirSync('output').map((dir) => path.join('output', dir, 'tree.json')).filter((file) => fs.existsSync(file))
    : [];
  return saved.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
};

const loadTree = (file: string) => {
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Tree(Leaf.from(saved.root), saved.unexplored);
};

rl.question('Please Enter Prompt (or a tree.json to grow further, or nothing for the latest): ', async (prompt) => {
  rl.close();
  let t: Tree;
  if (prompt.indexOf('.json') > -1 || prompt === '') {
    // Grow a saved tree further: the one given, or the latest run's
    const file = prompt || latestTree();
    if (!file) {
      console.log('There are no saved trees in output/ yet');
      return;
    }
    output.dir = path.dirname(file);
    t = loadTree(file);
  } else {
    output.dir = newRunDir(prompt);
    fs.mkdirSync(output.dir, { recursive: true });
    t = new Tree();

    await t.generateAndAddLeafToRoot(prompt);
  }

  // Saved after every round, so a long run that stops partway keeps what it grew.
  const file = path.join(output.dir, 'tree.json');
  const save = () => fs.writeFileSync(file, JSON.stringify(t, null, 2));
  save();

  let n = 6;

  for (var i = 0; i < n; i++) {
    try {
      await t.growTree();
    } catch (e) {
      console.log(e);
      console.log('ERROR');
    }
    save();
  }

  console.log(`The file has been saved! ${file}`);
});
