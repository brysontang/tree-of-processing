import { Leaf } from '../entities/leaf';
import { sketchRules } from './sketchRules';

// The 27B can't see images, so it gets the eyes' description of what the intern's code drew.
export const enhanceCodeTemplate = (leaf: Leaf, method: string) => `You are a senior generative artist and you are tasked will improving the interns code by ${method}. ONLY RETURN THE NEW CODE:

\`\`\`javascript
${leaf.code}
\`\`\`

This is what the intern's code draws: ${leaf.seen}

${sketchRules}`;
