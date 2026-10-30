// Two models, both behind OpenAI-compatible endpoints set in .env:
// - INFERENCE_*: writes the sketches, judges them and rewrites them (Qwen3.8 27B on a local server).
// - EYES_*: a small vision model that says what a sketch drew, because the 27B's worker takes text only.
import fs from 'node:fs/promises';

import { enhanceCodeTemplate } from '../templates/enchanceCode';
import { generateImageTemplate } from '../templates/generateImage';
import { evaluateCodeTemplate } from '../templates/evaluateCode';
import { describeImageTemplate } from '../templates/describeImage';
import { extractCodeFromOutput, notesFromOutput, scoreFromOutput } from './util';

import { Leaf } from '../entities/leaf';

type Content = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env (see .env.example)`);
  return value;
};

// One request, streamed so a long sketch can't run into a response timeout. Returns the reply without any
// <think> block.
const chat = async (base: string, model: string, key: string | undefined, content: Content, maxTokens: number) => {
  const started = Date.now();
  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: maxTokens,
      temperature: 0.5,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`${model}: HTTP ${res.status} ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let buffer = '';
  let finish: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const data = line.startsWith('data:') ? line.slice(5).trim() : '';
      if (!data || data === '[DONE]') continue;
      const event = JSON.parse(data);
      if (event.error) throw new Error(`${model}: ${JSON.stringify(event.error)}`);
      text += event.choices?.[0]?.delta?.content ?? '';
      finish = event.choices?.[0]?.finish_reason ?? finish;
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ${model}: ${seconds}s${finish === 'length' ? `, cut off at ${maxTokens} tokens` : ''}`);
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};

// The 27B runs on a shared server, where one worker takes two requests at a time for everything. The
// tree sends it one at a time.
let queue: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(job: () => Promise<T>): Promise<T> => {
  const next = queue.then(job);
  queue = next.catch(() => {});
  return next;
};

const think = (content: string, maxTokens = 8000) =>
  oneAtATime(() => chat(env('INFERENCE_URL'), env('INFERENCE_MODEL'), env('INFERENCE_API_KEY'), content, maxTokens));

/** What the eyes see in a screenshot. */
export const look = async (imagePath: string) => {
  const image = (await fs.readFile(imagePath)).toString('base64');
  const content: Content = [
    { type: 'text', text: describeImageTemplate() },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } },
  ];
  return chat(env('EYES_URL'), env('EYES_MODEL'), process.env.EYES_API_KEY, content, 400);
};

/** The root: the 27B's poetic and geometric reading of the prompt, and a sketch of it. */
export const generateAndExtractP5Code = async (userInput: string): Promise<Leaf> => {
  const out = await think(generateImageTemplate(userInput));
  const code = extractCodeFromOutput(out);
  if (!code) {
    console.log('Failed to generate code');
    console.log(out);
    return new Leaf('', '', -1, '');
  }
  return new Leaf(userInput, code, 0, 'root', [], -1, { notes: notesFromOutput(out) });
};

/** The leaf's code, rewritten by `method`. */
export const enhanceImage = async (method: string, leaf: Leaf) => {
  const out = await think(enhanceCodeTemplate(leaf, method));
  const newCode = extractCodeFromOutput(out);
  if (!newCode) {
    console.log('Failed to generate new code');
    console.log(out);
    return '';
  }
  return newCode;
};

/** 0-10, judged from what the eyes saw; null if the reply has no number in it. */
export const eveluateImage = async (leaf: Leaf) => {
  const out = await think(evaluateCodeTemplate(leaf), 20);
  return scoreFromOutput(out);
};
