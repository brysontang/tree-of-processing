import * as fs from 'node:fs/promises';
import path from 'path';

import { PromptTemplate } from 'langchain/prompts';
import { HumanMessage } from 'langchain/schema';

import { Leaf } from '../entities/leaf';

export const enhanceCodeTemplate = async (leaf: Leaf, method: string) => {
  // Sleep 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const methodWithoutSpaces = leaf.method.replace(/\s/g, '');
  const directory = './output';
  const imagePath = path.join(
    directory,
    `${leaf.hash}_${methodWithoutSpaces}.png`
  );

  const imageData = await fs.readFile(imagePath);

  const template = `You are a senior generative artist and you are tasked will improving the interns code by ${method}. ONLY RETURN THE NEW CODE:

    \`\`\`HTML
    {code}
    \`\`\`
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
