import { PromptTemplate } from 'langchain/prompts';

import { Leaf } from '../entities/leaf';


export const evaluateCodeTemplate = async (leaf: Leaf) => {
  // When the GPT-4 API allows image upload, we can use this function to evaluate the image
  // and return [0-10] until then we will give the code to GPT to evaluate.

  const template = `Your task is to look at some p5.js code and evaulate it on a scale of 0-10 ONLY OUTPUT THE NUMBER DO NOT OUTPUT ANY JUSTIFICATION FOR WHY YOU GAVE THE NUMBER, JUST THE NUMBER.
  Please evaluate based on the following criteria:
  - How complex will the output of the code be?
  - How innovative is the code?

  Code:
  \`\`\`HTML
  {code}
  \`\`\`
`;

  const prompt = new PromptTemplate({
    template: template,
    inputVariables: ['text', 'code'],
  });

  const text = await prompt.format({ text: leaf.prompt, code: leaf.code });

  return text;
};