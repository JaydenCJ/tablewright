// Display-width computation: the foundation of alignment. If these are
// wrong, every CJK or emoji table renders crooked.
import test from "node:test";
import assert from "node:assert/strict";

import { charWidth, displayWidth } from "../dist/width.js";

test("ascii text is one column per character", () => {
  assert.equal(displayWidth("Price"), 5);
  assert.equal(displayWidth(""), 0);
});

test("CJK ideographs, kana, Hangul and fullwidth forms are two columns each", () => {
  assert.equal(displayWidth("部品"), 4); // CJK ideographs
  assert.equal(displayWidth("ひらがな"), 8); // Hiragana
  assert.equal(displayWidth("한글"), 4); // Hangul syllables
  assert.equal(displayWidth("ＡＢ"), 4); // fullwidth latin
  assert.equal(charWidth("！".codePointAt(0)), 2);
});

test("combining marks and variation selectors are zero width", () => {
  // "é" as e + U+0301 must measure the same as precomposed "é".
  assert.equal(displayWidth("é"), 1);
  assert.equal(displayWidth("️"), 0); // variation selector-16
  assert.equal(displayWidth("​"), 0); // zero-width space
});

test("emoji from the main pictograph blocks are two columns", () => {
  assert.equal(displayWidth("\u{1f4e6}"), 2); // package emoji
  assert.equal(displayWidth("\u{1f680}"), 2); // rocket emoji
});

test("mixed-script strings sum per code point", () => {
  // 6 ascii (6) + 2 ideographs (4) + e with combining acute (1 + 0)
  assert.equal(displayWidth("Widget部品é"), 11);
});
