import fs from 'fs';
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

  let n = 20;
  
  for (var i = 0; i < n; i++) {
    await t.growTree();
  }

  fs.writeFile('output/tree.json', JSON.stringify(t, null, 2), (err) => {
    if (err) throw err;
    console.log('The file has been saved!');
  });

  rl.close();
});
