import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { vet } from '../tools/vet.mjs';
import { Leaf } from '../entities/leaf';
import { generateAndExtractP5Code, look, repairCode } from './llm_helpers';

// Where this run's screenshots and tree.json go. main.ts sets it.
export const output = { dir: 'output' };

export const imagePath = (leaf: Leaf) => path.join(output.dir, `${leaf.hash}_${leaf.method.replace(/\s/g, '')}.png`);

// Whether two leaves' screenshots look the same: their mean difference per pixel, out of 255, is under 1.5. Of 58
// parent→child pairs judged by eye, that caught 21 of the 25 that looked identical, and 2 of the 33 that didn't
// (both near-black). About half the rewrites in a tree can be like this, and their scores differ from their
// parent's by noise alone.
export const looksSame = (a: Leaf, b: Leaf) => {
  if (!fs.existsSync(imagePath(a)) || !fs.existsSync(imagePath(b))) return false;
  const [one, two] = [a, b].map((leaf) => PNG.sync.read(fs.readFileSync(imagePath(leaf))).data);
  if (one.length !== two.length) return false;
  let total = 0;
  for (let i = 0; i < one.length; i += 4) {
    total += (Math.abs(one[i] - two[i]) + Math.abs(one[i + 1] - two[i + 1]) + Math.abs(one[i + 2] - two[i + 2])) / 3;
  }
  return total / (one.length / 4) < 1.5;
};

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
