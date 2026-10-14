import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../src/chunk.mjs";

const LIMIT = 4096;

function assertReassembles(original, chunks) {
  assert.equal(chunks.join(""), original);
  assert.ok(chunks.every((c) => c.length <= LIMIT));
}

test("empty string chunks to nothing", () => {
  assert.deepEqual(chunkText(""), []);
});

test("short text is a single chunk", () => {
  assert.deepEqual(chunkText("a"), ["a"]);
});

test("exactly 4096 units stay in one chunk", () => {
  const text = "a".repeat(4096);
  const chunks = chunkText(text);
  assert.deepEqual(chunks, [text]);
});

test("4097 units split into 4096 and 1", () => {
  const text = "a".repeat(4097);
  const chunks = chunkText(text);
  assert.deepEqual(chunks.map((c) => c.length), [4096, 1]);
  assertReassembles(text, chunks);
});

test("prefers the last newline inside the window", () => {
  const text = "x".repeat(3000) + "\n" + "y".repeat(1999);
  const chunks = chunkText(text);
  assert.equal(chunks[0].length, 3001);
  assert.ok(chunks[0].endsWith("\n"));
  assert.ok(chunks[1].startsWith("y"));
  assertReassembles(text, chunks);
});

test("hard cut when no newline in window", () => {
  const text = "x".repeat(9000);
  const chunks = chunkText(text);
  assert.deepEqual(chunks.map((c) => c.length), [4096, 4096, 808]);
  assertReassembles(text, chunks);
});

test("hard cut backs off to avoid splitting a surrogate pair", () => {
  const emoji = "😀"; // surrogate pair, 2 UTF-16 units
  const text = "a".repeat(4095) + emoji + "b".repeat(10);
  const chunks = chunkText(text);
  assert.equal(chunks[0].length, 4095);
  assert.ok(chunks[1].startsWith(emoji));
  assertReassembles(text, chunks);
});
