import crypto from 'node:crypto';

import { drawP5 } from '../scripts/processing';
import { enhanceImage, eveluateImage } from '../scripts/llm_helpers';
import { possibleMethods } from '../scripts/util';

// What a leaf keeps besides its code: its hash (so a saved tree still matches its screenshots), the 27B's notes
// (the root's poetic and geometric descriptions), what the eyes saw it draw, why vetting turned it down, if a
// repair got it through, the broken code and what was wrong with it, and whether it was rewritten a second time.
type Repair = { problems: string[]; code: string };
type Extra = { hash?: string; notes?: string; seen?: string; problems?: string[]; repair?: Repair; retried?: boolean };

export class Leaf {
  prompt: string;
  code: string;
  hash: string;
  method: string;

  depth: number;

  score: number;

  notes: string;
  seen: string;
  problems: string[];
  repair?: Repair;
  retried?: boolean;

  children: Leaf[] = [];

  constructor(
    prompt: string,
    code: string,
    depth: number,
    method: string,
    children: Leaf[] = [],
    score: number = -1,
    extra: Extra = {}
  ) {
    this.prompt = prompt;
    this.code = code;
    this.score = score;
    this.method = method;

    this.depth = depth;

    this.hash =
      extra.hash ??
      crypto
        .createHash('sha256')
        .update(code + new Date().getTime().toString())
        .digest('hex')
        .slice(0, 10);

    this.notes = extra.notes ?? '';
    this.seen = extra.seen ?? '';
    this.problems = extra.problems ?? [];
    if (extra.repair) this.repair = extra.repair;
    if (extra.retried) this.retried = true;

    this.children = children.map((child) => Leaf.from(child));
  }

  /** A leaf, and its children, back from a saved tree.json. */
  static from(saved: Leaf): Leaf {
    return new Leaf(saved.prompt, saved.code, saved.depth, saved.method, saved.children, saved.score, saved);
  }

  addChild(leaf: Leaf) {
    this.children.push(leaf);
  }

  setScore(score: number) {
    this.score = score;
  }

  setHash(hash: string) {
    this.hash = hash;
  }

  getDeepestLeaf(): Leaf[] {
    if (this.children.length === 0) {
      return [this];
    }

    let deepestNodes: Leaf[] = [];
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];

      deepestNodes = deepestNodes.concat(child.getDeepestLeaf());
    }
    return deepestNodes;
  }

  async createChildren() {
    // Randomly select 3 methods
    const methods = possibleMethods.sort(() => 0.5 - Math.random()).slice(0, 3);

    const leaves: Leaf[] = [];
    await Promise.all(
      methods.map(async (method) => {
        const newCode = await enhanceImage(method, this);
        if (!newCode) return;

        const leaf = new Leaf(this.prompt, newCode, this.depth + 1, method);
        this.addChild(leaf);

        // A leaf that fails vetting keeps its score of -1 and isn't grown further.
        if (!(await drawP5(leaf))) return;

        const score = await eveluateImage(leaf);

        if (score === null) {
          console.log('Failed to evaluate image');
          return;
        }

        console.log(`Score: ${score}`);
        leaf.setScore(score);

        leaves.push(leaf);
      })
    );

    console.log('----Leaves----');
    console.log(leaves.length);

    return leaves;
  }
}
