// What every sketch has to fit: the sandbox it's vetted and drawn in (tools/vet.mjs) runs plain p5.js on a 640×640
// page with no network. The line about setup() is how p5's global mode works, and the 27B tripped on it: one
// rewrite ended with its own `setup();`, which runs before p5 has started, and one repair couldn't see why.
export const sketchRules = `Write plain JavaScript in one \`\`\`javascript block: p5.js 1.11 is already loaded on the page, so no HTML. Draw on a 640×640 canvas. Don't load files or use the network. p5 calls setup() and draw() itself, and its functions only exist once it has started, so never call them, or setup(), from the top level of the script.`;
