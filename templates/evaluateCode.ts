import { Leaf } from '../entities/leaf';

// The 27B can't see images, so it judges the eyes' description of the output.
export const evaluateCodeTemplate = (leaf: Leaf) => `Your task is to look at the output of some p5.js code (an image, described below) and evaulate it on a scale of 0-10 ONLY OUTPUT THE NUMBER DO NOT OUTPUT ANY JUSTIFICATION FOR WHY YOU GAVE THE NUMBER, JUST THE NUMBER.
Please evaluate based on the following criteria:
- How complex is the output?
- How innovative is the output?
- How visually pleasing is the output?

The output: ${leaf.seen}`;
