import crypto from 'crypto';

import { drawP5 } from '../scripts/processing';
import { enhanceCodeTemplate } from '../templates/enchanceCode';
import { eveluateImage, initializeModel } from '../scripts/llm_helpers';
import { extractCodeFromOutput, possibleMethods } from '../scripts/util';

export class Leaf {
  prompt: string;
  code: string;
  hash: string;

  depth: number;

  score: number;

  children: Leaf[];

  constructor(prompt: string, code: string, depth: number) {
    this.prompt = prompt;
    this.code = code;
    this.score = -1;

    this.depth = depth;

    this.hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 10);;

    this.children = [];
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

  async createChildren() {
    // Randomly select 3 methods
    const methods = possibleMethods.sort(() => 0.5 - Math.random()).slice(0, 3);

    const leaves: Leaf[] = [];
    await Promise.all(
      methods.map(async (method) => {
        const newCodePrompt = await enhanceCodeTemplate(this, method);

        const model = initializeModel('gpt-3.5-turbo');
        const newCodeText = await model.call(newCodePrompt, undefined, []);

        const newCode = extractCodeFromOutput(newCodeText);

        if (!newCode) {
          console.log('Failed to generate new code');
          return;
        }

        const leaf = new Leaf(this.prompt, newCode, this.depth + 1);
        await drawP5(leaf);

        this.addChild(leaf);

        const score = await eveluateImage(model, leaf);

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
