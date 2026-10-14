import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { init } from "../src/init.mjs";
import { configPath } from "../src/paths.mjs";

const expectedScaffold = [
  "{",
  '  "default": "personal",',
  '  "bots": { "main": { "tokenEnv": "TG_BOT_MAIN" } },',
  '  "channels": [{ "id": "personal", "bot": "main", "chatId": "123456789" }]',
  "}",
].join("\n");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "agent-tg-home-"));
}

test("fresh home: config scaffold created, skill written", () => {
  const home = freshHome();
  const skillDir = join(home, "skills", "agent-tg");
  const res = init({ env: {}, platform: "linux", home, skillDir });

  assert.equal(res.configCreated, true);
  assert.equal(res.configPath, configPath({ env: {}, platform: "linux", home }));
  assert.equal(res.skillPath, join(skillDir, "SKILL.md"));

  assert.equal(readFileSync(res.configPath, "utf8"), expectedScaffold + "\n");
  const skill = readFileSync(res.skillPath, "utf8");
  assert.match(skill, /^---\nname: agent-tg\n/);
  assert.ok(skill.includes("agent-tg send --to <alias>"));
});

test("pre-existing config is untouched", () => {
  const home = freshHome();
  const skillDir = join(home, "skills", "agent-tg");
  const cfg = configPath({ env: {}, platform: "linux", home });
  mkdirSync(join(home, ".config", "agent-tg"), { recursive: true });
  writeFileSync(cfg, '{"bots":{"b":{"token":"x"}},"channels":[{"id":"c","bot":"b","chatId":"1"}]}');

  const res = init({ env: {}, platform: "linux", home, skillDir });
  assert.equal(res.configCreated, false);
  assert.equal(readFileSync(cfg, "utf8"), '{"bots":{"b":{"token":"x"}},"channels":[{"id":"c","bot":"b","chatId":"1"}]}');
});

test("skill is always overwritten with the source content", () => {
  const home = freshHome();
  const skillDir = join(home, "skills", "agent-tg");
  mkdirSync(skillDir, { recursive: true });
  const dest = join(skillDir, "SKILL.md");
  writeFileSync(dest, "USER EDITED JUNK");

  init({ env: {}, platform: "linux", home, skillDir });
  const restored = readFileSync(dest, "utf8");
  assert.notEqual(restored, "USER EDITED JUNK");
  assert.match(restored, /^---\nname: agent-tg\n/);
});

test("default skillDir is $home/.agents/skills/agent-tg", () => {
  const home = freshHome();
  const res = init({ env: {}, platform: "linux", home });
  assert.equal(res.skillPath, join(home, ".agents", "skills", "agent-tg", "SKILL.md"));
  assert.ok(existsSync(res.skillPath));
});
