import path from 'node:path';

import { vet } from '../tools/vet.mjs';
import { Leaf } from '../entities/leaf';
import { generateAndExtractP5Code, look } from './llm_helpers';

// Where this run's screenshots and tree.json go. main.ts sets it.
export const output = { dir: 'output' };

export const imagePath = (leaf: Leaf) => path.join(output.dir, `${leaf.hash}_${leaf.method.replace(/\s/g, '')}.png`);

type Issue = { line: number; reason: string; detail: string };

// Vets the leaf's code the way the gallery does: a static scan, then a dry run in its sandbox, which saves the
// screenshot. Code that fails the scan never runs. Then the eyes say what it drew. Returns whether it passed.
export const drawP5 = async (leaf: Leaf) => {
  console.log('Vetting and drawing...');
  const report = await vet(leaf.code, { screenshot: imagePath(leaf) });
  if (!report.ok) {
    leaf.problems = [
      ...report.static.issues.map((i: Issue) => `line ${i.line}: ${i.reason} (${i.detail})`),
      ...(report.run?.problems ?? []),
    ];
    console.log(`Turned down: ${leaf.problems.join('; ')}`);
    return false;
  }
  leaf.seen = await look(imagePath(leaf));
  console.log(`Seen: ${leaf.seen}`);
  return true;
};

export const generateP5 = async (userInput: string): Promise<Leaf> => {
  try {
    return await generateAndExtractP5Code(userInput);
  } catch (err) {
    throw new Error(`Failed to generate and extract code: ${err}`);
  }
};
