import * as fs from 'node:fs/promises';
import path from 'path';

import { PromptTemplate } from 'langchain/prompts';
import { HumanMessage } from 'langchain/schema';

import { Leaf } from '../entities/leaf';

export const evaluateCodeTemplate = async (leaf: Leaf) => {
  // When the GPT-4 API allows image upload, we can use this function to evaluate the image
  // and return [0-10] until then we will give the code to GPT to evaluate.

  const methodWithoutSpaces = leaf.method.replace(/\s/g, '');
  const directory = './output';
  const imagePath = path.join(
    directory,
    `${leaf.hash}_${methodWithoutSpaces}.png`
  );

  const imageData = await fs.readFile(imagePath);

  const template = `Your task is to look at the output of some p5.js code (an image) and evaulate it on a scale of 0-10 ONLY OUTPUT THE NUMBER DO NOT OUTPUT ANY JUSTIFICATION FOR WHY YOU GAVE THE NUMBER, JUST THE NUMBER.
  Please evaluate based on the following criteria:
  - How complex is the output?
  - How innovative is the output?
  - How visually pleasing is the output?
`;

  const prompt = new PromptTemplate({
    template: template,
    inputVariables: ['text', 'code'],
  });

  const text = await prompt.format({ text: leaf.prompt, code: leaf.code });

  const message = new HumanMessage({
    content: [
      {
        type: 'text',
        text,
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageData.toString('base64')}`,
        },
      },
    ],
  });

  return message;
};
