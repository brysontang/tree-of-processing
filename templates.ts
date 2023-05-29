import { PromptTemplate } from 'langchain/prompts';

import { Leaf } from './leaf';

export const generateImageTemplate = async (userInput: string) => {
  const template = `Your task is to write some code to draw the following item surrounded by three backticks: \`\`\`{text}\`\`\`
To solve this problem you will:
- First describe the item in poetic language
- Then represent the poetry in geometric language
- Create a 2D p5js script to draw the item as described, DO NOT ADD COMMENTS TO THE CODE

Using the following format:
Description: <poetic language>

Geometric: <geometric language>

Code:
\`\`\`HTML
      <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
      <script>
          function setup() {{
            createCanvas(400, 400);
          }}

          function draw() {{
            ...
          }}
      </script>
\`\`\`
`;

  const prompt = new PromptTemplate({
    template: template,
    inputVariables: ['text'],
  });

  const text = await prompt.format({ text: userInput });

  return text;
};

export const evaluateCodeTemplate = async (leaf: Leaf) => {
  // When the GPT-4 API allows image upload, we can use this function to evaluate the image
  // and return [0-10] until then we will give the code to GPT to evaluate.

  const template = `Your task is to look at some p5.js code and evaulate it on a scale of 0-10 ONLY OUTPUT THE NUMBER DO NOT OUTPUT ANY JUSTIFICATION FOR WHY YOU GAVE THE NUMBER, JUST THE NUMBER.
  Please evaluate based on the following criteria:
  - How unique is this code?
  - How non-trivial is this code?
  - How creative is this code?

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
