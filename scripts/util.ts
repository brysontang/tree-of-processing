// The sketch in a reply: its longest fenced code block. The models are asked for plain p5.js; if one wraps it in
// an HTML page anyway, the page's inline scripts are the sketch.
export const extractCodeFromOutput = (output: string) => {
  const blocks = [...output.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const code = blocks.sort((a, b) => b.length - a.length)[0];
  if (!code) return null;
  const inline = [...code.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  return (inline.length ? inline.join('\n') : code).trim() || null;
};

// A reply without its code: the root's poetic and geometric descriptions.
export const notesFromOutput = (output: string) =>
  output
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*Code:\s*$/m, '')
    .trim();

// The first whole number from 0 to 10 in a reply.
export const scoreFromOutput = (output: string) => {
  const match = output.match(/\b(10|[0-9])\b/);
  return match ? Number(match[1]) : null;
};

export const possibleMethods = [
  'adding a unique idea to the script',
  'refactoring the code and expand the functionality',
  'adding recursion to the code',
  'reimagining the code',
];
