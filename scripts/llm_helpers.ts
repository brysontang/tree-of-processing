import { OpenAI } from 'langchain/llms/openai';

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

export const generateAndExtractP5Code = async (
  model: any,
  userInput: string
): Promise<Leaf> => {
  const text = await generateImageTemplate(userInput);
  const out = await model.call(text, undefined, []);

  if (!out) {
    console.log('Failed to generate code')
    console.log(out)
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

  const text = await evaluateCodeTemplate(leaf);
  const out = await model.call(text, undefined, []);

  if (!out) {
    return '';
  }

  return out;
};
