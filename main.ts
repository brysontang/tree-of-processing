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

  let n = 2;
  
  for (var i = 0; i < n; i++) {
    await t.growTree();
  }

  rl.close();
});
