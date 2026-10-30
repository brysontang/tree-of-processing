import { sketchRules } from './sketchRules';

export const generateImageTemplate = (userInput: string) => `Your task is to take a user input and try to create a peice of generative art to represents that feeling.
The user input will be surrounded by three backticks:
\`\`\`
${userInput}
\`\`\`
To solve this problem you will:
- First describe the item in poetic language
- Then represent the poetry in geometric language
- Create a 2D p5js script to draw the item as described, DO NOT ADD COMMENTS TO THE CODE

Using the following format:
Description: <poetic language>

Geometric: <geometric language>

Code:
\`\`\`javascript
function setup() {
  createCanvas(640, 640);
}

function draw() {
  ...
}
\`\`\`

${sketchRules}`;
