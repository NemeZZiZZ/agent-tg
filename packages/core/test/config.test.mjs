import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.mjs";

const valid = {
  default: "dev",
  bots: { main: { tokenEnv: "TG_TOKEN_MAIN" }, other: { token: "111:inline" } },
  channels: [
    { id: "dev", bot: "main", chatId: "12345" },
    { id: "ops", bot: "other", chatId: "-100999" },
  ],
};

function writeConfig(content) {
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-cfg-"));
  const file = join(dir, "config.json");
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  return file;
}

async function assertInvalid(content, re) {
  const configPath = writeConfig(content);
  await assert.rejects(
    () => loadConfig({ configPath }),
    (err) => err.code === "CONFIG_INVALID" && re.test(err.message),
  );
}

test("happy path returns the parsed config as-is", async () => {
  const configPath = writeConfig(valid);
  const cfg = await loadConfig({ configPath });
  assert.deepEqual(cfg, valid);
});

test("unparseable JSON is CONFIG_INVALID", () =>
  assertInvalid("{ not json", /not valid JSON/i));

test("invalid-JSON error message never echoes config file content", async () => {
  // Realistic user error: a bare bot token pasted as the whole config file.
  // V8's parse errors quote the start of the input ("Unexpected token 'L',
  // \"LEAK123456\"... is not valid JSON") — that snippet must not reach the user.
  const configPath = writeConfig("LEAK123456:AAF-full-token-hash-here");
  await assert.rejects(
    () => loadConfig({ configPath }),
    (err) => err.code === "CONFIG_INVALID" && !err.message.includes("LEAK123456"),
  );
});

test("bots not a non-empty object is CONFIG_INVALID", () =>
  assertInvalid({ ...valid, bots: {} }, /bots/i));

test("channels not a non-empty array is CONFIG_INVALID", () =>
  assertInvalid({ ...valid, channels: "nope" }, /channels/i));

test("duplicate channel ids are CONFIG_INVALID", () =>
  assertInvalid({
    bots: { main: { tokenEnv: "T" } },
    channels: [
      { id: "dev", bot: "main", chatId: "1" },
      { id: "dev", bot: "main", chatId: "2" },
    ],
  }, /unique|duplicate/i));

test("channel referencing unknown bot is CONFIG_INVALID", () =>
  assertInvalid({
    bots: { main: { tokenEnv: "T" } },
    channels: [{ id: "dev", bot: "ghost", chatId: "1" }],
  }, /bot/i));

test("empty chatId is CONFIG_INVALID", () =>
  assertInvalid({
    bots: { main: { tokenEnv: "T" } },
    channels: [{ id: "dev", bot: "main", chatId: "" }],
  }, /chatId/i));

test("default matching no channel is CONFIG_INVALID", () =>
  assertInvalid({
    default: "nope",
    bots: { main: { tokenEnv: "T" } },
    channels: [{ id: "dev", bot: "main", chatId: "1" }],
  }, /default/i));

test("bot with neither tokenEnv nor token is CONFIG_INVALID", () =>
  assertInvalid({
    bots: { main: {} },
    channels: [{ id: "dev", bot: "main", chatId: "1" }],
  }, /token/i));

test("missing config file is NO_CONFIG pointing at init", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-cfg-"));
  await assert.rejects(
    () => loadConfig({ configPath: join(dir, "absent.json") }),
    (err) => err.code === "NO_CONFIG" && /agent-tg init/.test(err.message),
  );
});

test("inline token warns naming the bot and the path", async () => {
  const configPath = writeConfig(valid);
  const warnings = [];
  await loadConfig({ configPath, warn: (m) => warnings.push(m) });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"other"/);
  assert.match(warnings[0], /inline token/);
  assert.ok(warnings[0].includes(configPath));
});
