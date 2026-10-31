# tree-of-processing
Utilizes the idea of tree of thought to generate p5js scripts from a text prompt. The output will be saved to the output folder.

A model reads the prompt poetically, then geometrically, and writes a p5.js sketch of it. Each round, a leaf of
the tree is rewritten three ways (adding a unique idea, refactoring and expanding, adding recursion, or
reimagining it), and each rewrite is drawn and scored 0-10. Six rounds grow the tree. When all of a sketch's
rewrites score lower than it, it gets rewritten once more before the tree moves on.

Two models do the work, both through OpenAI-compatible endpoints:

- **The writer** (`INFERENCE_*`) writes the sketches, judges them and rewrites them: Qwen3.8 27B on a server on the local network.
  It's sent one request at a time, since that server is shared with other work.
- **The eyes** (`EYES_*`) describe what each sketch drew, because the writer's endpoint takes text only:
  qwen2.5vl:7b in Ollama on the same machine. The writer judges and rewrites from that description.

Model-written code is untrusted. Every sketch is vetted with the generative art gallery's checks
(`tools/vet.mjs`, copied from `../generative_art`): a static scan, then a dry run in its sandbox (`js/sandbox.js`)
with no network, which also takes the screenshot. p5.js itself is served from `vendor/`, so nothing in a run
leaves the local network. A sketch that fails gets one repair: the writer is shown exactly
what went wrong, and its fix is vetted from scratch. One that still fails is kept in the tree with the reasons, and
isn't grown further.

The eyes lead with how clearly the shapes stand out, then how bright the frame is and how much of it is empty. Told
only to describe, they made near-black frames sound like rich constellations, and the writer scored and kept building
on them. The writer scores what the eyes saw against a description of each part of the scale, from "blank" up to
"you'd hang it on a wall".

## Running it

Copy `.env.example` to `.env` and fill in the key. For a DFS (best score first) add `METHOD="DFS"`.

`npm install`

`npm run start`

Type a prompt, and the run is saved to its own folder, like `output/internet-20261030-2051/`: a screenshot per
sketch and `tree.json`, saved after every round. Type the path of a `tree.json` to grow that tree further, or
nothing to grow the latest one.

Each leaf in `tree.json` has its `code`, `score`, `method`, what the eyes `seen`, the `problems` that got it
turned down, its `repair` if it had one (the code before, and what was wrong with it), and on the root, the
writer's poetic and geometric `notes`.

*You must have NodeJs >= v20 and Google Chrome installed*
