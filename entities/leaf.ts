import crypto from 'crypto';

import { drawP5 } from '../scripts/processing';
import { enhanceCodeTemplate } from '../templates/enchanceCode';
import { eveluateImage, initializeModel } from '../scripts/llm_helpers';
import { extractCodeFromOutput } from '../scripts/util';

export class Leaf {
  prompt: string;
  code: string;
  hash: string;

  score: number;

  children: Leaf[];

  constructor(prompt: string, code: string) {
    this.prompt = prompt;
    this.code = code;
    this.score = -1;

    this.hash = crypto.createHash('sha256').update(code).digest('hex');

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
    const methods = [
      'adding a unique feature',
      'adding a non-trivial feature',
      'adding a creative feature',
    ];

    const leaves: Leaf[] = [];
    await Promise.all(methods.map(async (method) => {
      const newCodePrompt = await enhanceCodeTemplate(this, method);

      const model = initializeModel('gpt-3.5-turbo');
      const newCodeText = await model.call(newCodePrompt, undefined, []);

      const newCode = extractCodeFromOutput(newCodeText);

      if (!newCode) {
        console.log('Failed to generate new code');
        return;
      }

      const leaf = new Leaf(this.prompt, newCode);
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
    }));

    console.log("----Leaves----")
    console.log(leaves.length)

    return leaves;
  }
}
