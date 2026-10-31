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

    // This round's rewrites that passed vetting and were scored, and changed how the sketch looks. One that looks the
    // same is kept in the tree but not grown: growing it would only be growing its parent again.
    const children = (await leaf.createChildren()).filter((child) => !child.same);
    console.log('Created children');
    console.log(leaf.children.length);

    this.printTree();

    if (leaf.depth >= 4) {
      return;
    }

    // Only add children to explore list if the depth is less than 4, and only ones that passed vetting. Best score
    // first unless METHOD is BFS: it's the order that uses the judge, and every good tree so far grew that way.
    if (process.env.METHOD === 'BFS') {
      console.log('BFS');
      this.unexplored.push(...children);
    } else {
      console.log('DFS');
      for (let i = 0; i < children.length; i++) {
        this.addLeafToUnexplored(children[i]);
      }
    }

    // When every rewrite scored lower or looks the same, the leaf goes back to the front to be rewritten once more,
    // rather than the tree only growing from worse sketches. Rewrites carry over the look of the code they're given,
    // so one bad turn (a near-black reimagining of a clear root) otherwise sets the look of everything after it.
    if (!leaf.retried && !children.some((child) => child.score >= leaf.score)) {
      console.log('Every rewrite scored lower or looks the same, so this one gets rewritten again');
      leaf.retried = true;
      this.unexplored.unshift(leaf);
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
        (node.retried ? ' (rewritten twice)' : '') +
        (node.same ? ' (looks the same)' : '') +
        (node.repair ? (node.problems.length ? ' (repair failed)' : ' (repaired)') : '') +
        (node.problems.length ? ' (turned down)' : '')
    );
    for (let i = 0; i < node.children.length; i++) {
      // Add a "-" for each level of depth
      this.printNode(node.children[i], prefix + '-');
    }
  }
}
