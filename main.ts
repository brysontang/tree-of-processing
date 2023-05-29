import * as readline from 'readline';
import * as dotenv from 'dotenv';

import { Tree } from './entities/tree';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Please Enter Prompt: ', async (prompt) => {
  let t = new Tree();

  await t.generateAndAddLeafToRoot(prompt);

  await t.growTree();
  await t.growTree();

  rl.close();
});
