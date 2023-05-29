import { OpenAI } from 'langchain/llms/openai';

import { generateImageTemplate, evaluateCodeTemplate } from './templates';
import { extractCodeFromOutput } from './util';

import { Leaf } from './leaf';

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
    return new Leaf('', '');
  }

  const extractedCode = extractCodeFromOutput(out);

  if (extractedCode) {
    return new Leaf(userInput, extractedCode);
  }

  return new Leaf('', '');
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
