import { PromptTemplate } from 'langchain/prompts';

import { Leaf } from '../entities/leaf';

export const enhanceCodeTemplate = async (leaf: Leaf, method: string) => {
    const template = `Your task is to enhance the following code by ${method}. ONLY RETURN THE NEW CODE:
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
  