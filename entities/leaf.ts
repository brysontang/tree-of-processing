import crypto from 'crypto';

import { drawP5 } from '../scripts/processing';
import { enhanceCodeTemplate } from '../templates/enchanceCode';
import {
  eveluateImage,
  initializeModel,
  initializeChatModel,
} from '../scripts/llm_helpers';
import { extractCodeFromOutput, possibleMethods } from '../scripts/util';

export class Leaf {
  prompt: string;
  code: string;
  hash: string;
  method: string;

  depth: number;

  score: number;

  children: Leaf[] = [];

  constructor(
    prompt: string,
    code: string,
    depth: number,
    method: string,
    children: Leaf[] = [],
    score: number = -1
  ) {
    this.prompt = prompt;
    this.code = code;
    this.score = score;
    this.method = method;

    this.depth = depth;

    this.hash = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex')
      .slice(0, 10);

    if (children.length === 0) {
      this.children = [];
    } else {
      for (let i = 0; i < children.length; i++) {
        const child: Leaf = children[i];
        this.children.push(
          new Leaf(
            child.prompt,
            child.code,
            child.depth,
            child.method,
            child.children,
            child.score
          )
        );
      }
    }
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
        const newCodePrompt = await enhanceCodeTemplate(this, method);

        const model4 = initializeChatModel('gpt-4-vision-preview');
        const model3 = initializeModel('gpt-3.5-turbo');
        const newCodeText = await model3.call(newCodePrompt, undefined, []);

        const newCode = extractCodeFromOutput(newCodeText);

        if (!newCode) {
          console.log(newCodeText);
          console.log('Failed to generate new code');
          return;
        }

        const leaf = new Leaf(this.prompt, newCode, this.depth + 1, method);
        await drawP5(leaf);

        this.addChild(leaf);

        const score = await eveluateImage(model4, leaf);

        if (!score) {
          console.log('Failed to evaluate image');
          return;
        }

        console.log(`Score: ${score}`);
        leaf.setScore(parseInt(score, 10));

        leaves.push(leaf);
      })
    );

    console.log('----Leaves----');
    console.log(leaves.length);

    return leaves;
  }
}
