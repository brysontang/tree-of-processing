import fs from 'fs';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

import { Tree } from './entities/tree';
import { Leaf } from './entities/leaf';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Please Enter Prompt: ', async (prompt) => {
  let t;
  if (prompt.indexOf('.json') > -1) {
    // Read the json file there is a tree object in it
    const tree = await fs.readFileSync(prompt, 'utf8');

    const treeObjec = JSON.parse(tree);
    console.log(treeObjec.root);
    const root: Leaf = new Leaf(
      treeObjec.root.prompt,
      treeObjec.root.code,
      treeObjec.root.depth,
      treeObjec.root.method,
      treeObjec.root.children,
      treeObjec.root.score
    );
    t = new Tree(root, treeObjec.unexplored);
  } else if (prompt === '') {
    // Read the json file there is a tree object in it
    const tree = await fs.readFileSync('output/tree.json', 'utf8');

    const treeObjec = JSON.parse(tree);
    console.log(treeObjec.root);
    const root: Leaf = new Leaf(
      treeObjec.root.prompt,
      treeObjec.root.code,
      treeObjec.root.depth,
      treeObjec.root.method,
      treeObjec.root.children,
      treeObjec.root.score
    );
    t = new Tree(root, treeObjec.unexplored);
  } else {
    t = new Tree();

    await t.generateAndAddLeafToRoot(prompt);
  }

  let n = 6;

  for (var i = 0; i < n; i++) {
    try {
      await t.growTree();
    } catch (e) {
      console.log(e);
      console.log('ERROR');
    }
  }

  fs.writeFile('output/tree.json', JSON.stringify(t, null, 2), (err) => {
    if (err) throw err;
    console.log('The file has been saved!');
  });

  rl.close();
});
