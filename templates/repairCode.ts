import { Leaf } from '../entities/leaf';
import { sketchRules } from './sketchRules';

// One try at fixing a sketch that failed vetting, shown exactly what went wrong.
export const repairCodeTemplate = (leaf: Leaf) => `This p5.js sketch failed when it was run:
${leaf.problems.map((problem) => `- ${problem}`).join('\n')}

Fix it, changing as little as you can, and return the whole sketch. ONLY RETURN THE NEW CODE:

\`\`\`javascript
${leaf.code}
\`\`\`

${sketchRules}`;
