import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { Leaf } from '../entities/leaf';

import {
  initializeModel,
  generateAndExtractP5Code,
  DEFAULT_MODEL_NAME,
} from './llm_helpers';

export const drawP5 = async (leaf: Leaf) => {
  console.log('Opening browser...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Go to a blank page and run the p5.js code
  await page.goto(`data:text/html,${leaf.code}`);

  // Wait for the p5.js sketch to render
  await page.waitForTimeout(2000);

  console.log('Taking screenshot...');
  // Capture the canvas as an image
  const directory = './output';
  fs.mkdirSync(directory, { recursive: true });

  const canvas = await page.$('canvas');
  const methodWithoutSpaces = leaf.method.replace(/\s/g, '');
  const screenshot = await canvas?.screenshot({
    path: path.join(directory, `${leaf.hash}_${leaf.score}_${methodWithoutSpaces}.png`),
  });

  await browser.close();
};

export const generateP5 = async (
  userInput: string,
  modelName: string = DEFAULT_MODEL_NAME
): Promise<Leaf> => {
  const model = initializeModel(modelName);

  try {
    return await generateAndExtractP5Code(model, userInput);
  } catch (err) {
    throw new Error(`Failed to generate and extract code: ${err}`);
  }
};
