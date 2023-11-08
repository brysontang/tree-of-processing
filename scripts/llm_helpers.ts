import * as fs from 'node:fs/promises';
import path from 'path';

import { OpenAI } from 'langchain/llms/openai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage } from 'langchain/schema';

import { generateImageTemplate } from '../templates/generateImage';
import { evaluateCodeTemplate } from '../templates/evaluateCode';
import { extractCodeFromOutput } from './util';

import { Leaf } from '../entities/leaf';

export const DEFAULT_MODEL_NAME = 'gpt-3.5-turbo';

export const initializeModel = (modelName: string) => {
  const temperature = 0.5,
    maxTokens = 500;

  return new OpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName,
    temperature,
    maxTokens,
    streaming: true,
  });
};

export const initializeChatModel = (modelName: string) => {
  const temperature = 0.5,
    maxTokens = 500;

  return new ChatOpenAI({
    modelName,
    temperature,
    maxTokens,
  });
};

export const generateAndExtractP5Code = async (
  model: any,
  userInput: string
): Promise<Leaf> => {
  const text = await generateImageTemplate(userInput);
  const out = await model.call(text, undefined, []);

  if (!out) {
    console.log('Failed to generate code');
    console.log(out);
    return new Leaf('', '', -1, '');
  }

  const extractedCode = extractCodeFromOutput(out);

  if (extractedCode) {
    // This generates a root leaf
    return new Leaf(userInput, extractedCode, 0, 'root');
  }

  return new Leaf('', '', -1, '');
};

export const eveluateImage = async (model: any, leaf: Leaf) => {
  // When the GPT-4 API allows image upload, we can use this function to evaluate the image
  // and return [0-10] until then we will give the code to GPT to evaluate.

  const methodWithoutSpaces = leaf.method.replace(/\s/g, '');
  const directory = './output';
  const imagePath = path.join(
    directory,
    `${leaf.hash}_${leaf.score}_${methodWithoutSpaces}.png`
  );

  const imageData = await fs.readFile(imagePath);

  const text = await evaluateCodeTemplate(leaf);
  console.log(imagePath);

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

  const out = await model.invoke([message]);

  if (!out) {
    return '';
  }

  return out.content;
};
