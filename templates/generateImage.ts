import { PromptTemplate } from 'langchain/prompts';

export const generateImageTemplate = async (userInput: string) => {
    const template = `Your task is to take a user input and try to create a peice of art to represents that feeling. The user input will be surrounded by three backticks: \`\`\`{text}\`\`\`
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