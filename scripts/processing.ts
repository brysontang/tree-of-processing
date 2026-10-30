import path from 'node:path';

import { vet } from '../tools/vet.mjs';
import { Leaf } from '../entities/leaf';
import { generateAndExtractP5Code, look, repairCode } from './llm_helpers';

// Where this run's screenshots and tree.json go. main.ts sets it.
export const output = { dir: 'output' };

export const imagePath = (leaf: Leaf) => path.join(output.dir, `${leaf.hash}_${leaf.method.replace(/\s/g, '')}.png`);

type Issue = { line: number; reason: string; detail: string };

// Vets the leaf's code the way the gallery does: a static scan, then a dry run in its sandbox, which saves the
// screenshot. Code that fails the scan never runs.
const vetLeaf = async (leaf: Leaf) => {
  const report = await vet(leaf.code, { screenshot: imagePath(leaf) });
  leaf.problems = report.ok
    ? []
    : [...report.static.issues.map((i: Issue) => `line ${i.line}: ${i.reason} (${i.detail})`), ...(report.run?.problems ?? [])];
  if (!report.ok) console.log(`Turned down: ${leaf.problems.join('; ')}`);
  return report.ok as boolean;
};

// Vets the leaf, and if it fails, gives the model one try at fixing what went wrong; the fix is vetted from
// scratch, and the broken version is kept on the leaf. Then the eyes say what it drew. Returns whether it passed.
export const drawP5 = async (leaf: Leaf) => {
  console.log('Vetting and drawing...');
  if (!(await vetLeaf(leaf))) {
    const fixed = await repairCode(leaf);
    if (!fixed) return false;
    leaf.repair = { problems: leaf.problems, code: leaf.code };
    leaf.code = fixed;
    if (!(await vetLeaf(leaf))) return false;
    console.log('Repaired');
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
