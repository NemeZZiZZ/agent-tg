import { test } from "node:test";
import assert from "node:assert/strict";
import * as api from "../src/index.mjs";

test("barrel exports the full public API", () => {
  const names = [
    "configPath",
    "loadConfig",
    "resolveChannel",
    "channelList",
    "sendText",
    "sendFile",
    "sendRich",
    "chunkText",
    "init",
    "TgError",
  ];
  assert.deepEqual(Object.keys(api).sort(), names.sort());
  for (const name of names) {
    if (name === "TgError") continue;
    assert.equal(typeof api[name], "function", `${name} must be a function`);
  }
});

test("TgError is the exported class with .code", () => {
  const err = new api.TgError("boom", "NO_CONFIG");
  assert.ok(err instanceof Error);
  assert.equal(err.name, "TgError");
  assert.equal(err.code, "NO_CONFIG");
});
