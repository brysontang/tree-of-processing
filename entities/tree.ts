import { drawP5, generateP5 } from '../scripts/processing';
import { eveluateImage } from '../scripts/llm_helpers';

import { Leaf } from './leaf';

// Leaves worth growing: ones that passed vetting and were scored.
const growable = (leaf: Leaf) => leaf.score >= 0;

export class Tree {
  root: Leaf;

  unexplored: Leaf[];

  constructor(root = new Leaf('', '', -1, ''), unexplored: Leaf[] = []) {
    this.root = root;

    if (unexplored.length === 0) {
      this.unexplored = [];
    } else {
      this.unexplored = this.root.getDeepestLeaf().filter(growable);

      console.log(this.unexplored.map((leaf) => leaf.hash));
    }
  }

  async generateLeaf(prompt: string): Promise<Leaf> {
    const leaf = await generateP5(prompt);
    if (!leaf.code || !(await drawP5(leaf))) return leaf;

    const score = await eveluateImage(leaf);

    if (score === null) {
      console.log('Failed to evaluate image');
      return leaf;
    }

    console.log(`Score: ${score}`);
    leaf.setScore(score);

    return leaf;
  }

  // A tree can only grow from a root that passes vetting, so the root gets three tries.
  async generateAndAddLeafToRoot(prompt: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const leaf = await this.generateLeaf(prompt);
      this.root = leaf;
      if (growable(leaf)) {
        this.unexplored.push(leaf);
        return;
      }
      console.log(`The root didn't make it (try ${attempt} of 3)`);
    }
  }

  addLeafToUnexplored(leaf: Leaf) {
    for (let i = 0; i < this.unexplored.length; i++) {
      let ux = this.unexplored[i];
      if (ux.score < leaf.score) {
        this.unexplored.splice(i, 0, leaf);
        return;
      }
    }

    this.unexplored.push(leaf);
  }

  async growTree() {
    console.log('Growing tree');
    const leaf = this.unexplored.shift();

    if (!leaf) {
      console.log('No leaves to explore');
      return;
    }

    await leaf.createChildren();
    console.log('Created children');
    console.log(leaf.children.length);

    this.printTree();

    if (leaf.depth >= 4) {
      return;
    }

    // Only add children to explore list if the depth is less than 4, and only ones that passed vetting
    const children = leaf.children.filter(growable);
    if (process.env.METHOD === 'BFS') {
      console.log('BFS');
      this.unexplored.push(...children);
    } else if (process.env.METHOD === 'DFS') {
      console.log('DFS');
      for (let i = 0; i < children.length; i++) {
        this.addLeafToUnexplored(children[i]);
      }
    } else {
      this.unexplored.push(...children);
    }
  }

  printTree() {
    console.log('---------------Tree---------------');
    this.printNode(this.root, '');
  }

  printNode(node: Leaf, prefix: string) {
    console.log(
      prefix +
        'hash: ' +
        node.hash +
        ' score: ' +
        node.score +
        ' method: ' +
        node.method +
        (node.problems.length ? ' (turned down)' : '') +
        (node.repair ? ' (repaired)' : '')
    );
    for (let i = 0; i < node.children.length; i++) {
      // Add a "-" for each level of depth
      this.printNode(node.children[i], prefix + '-');
    }
  }
}
