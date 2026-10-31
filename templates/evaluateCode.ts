import { Leaf } from '../entities/leaf';

// The 27B can't see images, so it judges the eyes' description of the output, against an anchor for each part of the
// scale. Asked only how complex, innovative and pleasing the output was, it gave the same score to most rewrites that
// a person could see had improved a sketch: on 40 parent→child pairs judged by eye, it agreed on 11 and disagreed on
// 7. With the anchors, 17 and 7. Asking it which of two descriptions was better did no better than the anchors, for
// thirty times the tokens.
export const evaluateCodeTemplate = (leaf: Leaf) => `Score the output of some p5.js code (an image, described below) from 0 to 10, using the whole scale:
0-1: blank, or almost nothing visible
2-3: something is drawn, but it's faint, washed out, or a plain repeated pattern
4-5: a clear, competent image without much to hold the eye
6-7: an attractive, well-composed image with some depth or surprise
8-10: striking; you'd hang it on a wall
Only output the number.

The output: ${leaf.seen}`;
