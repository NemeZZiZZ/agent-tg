import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./helpers/server.mjs";

const BIN = new URL("../bin/agent-tg.mjs", import.meta.url).pathname;
const TOKEN = "TESTTOKEN";

const config = {
  default: "personal",
  bots: { main: { tokenEnv: "TG_BOT_MAIN" } },
  channels: [{ id: "personal", bot: "main", chatId: "123" }],
};

function writeFixtureConfig() {
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-cli-"));
  const file = join(dir, "config.json");
  writeFileSync(file, JSON.stringify(config));
  return file;
}

function run(args, { env, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { env: env ?? process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function envFor(serverUrl, overrides = {}) {
  return {
    ...process.env,
    AGENT_TG_CONFIG: writeFixtureConfig(),
    TG_BOT_MAIN: TOKEN,
    AGENT_TG_API_BASE: serverUrl ?? "http://127.0.0.1:1",
    ...overrides,
  };
}

function assertCleanStderr(t, stderr) {
  assert.ok(!stderr.includes("MODULE_NOT_FOUND"), `stderr: ${stderr}`);
  assert.ok(!stderr.includes(TOKEN), `stderr leaked token: ${stderr}`);
  assert.ok(!/\n\s+at /.test(stderr), `stderr has a stack trace: ${stderr}`);
}

test("send positional text → success line", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const r = await run(["send", "--to", "personal", "hello"], { env: envFor(s.url) });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), "✓ sent to personal (1 chunk)");
  assert.equal(s.requests.length, 1);
  assertCleanStderr(t, r.stderr);
});

test("send reads piped stdin", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const r = await run(["send", "--to", "personal"], { env: envFor(s.url), input: "piped message\n" });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), "✓ sent to personal (1 chunk)");
  assert.equal(s.requests[0].json.text, "piped message\n");
});

test("send 5000 chars → 2 chunks", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const r = await run(["send", "x".repeat(5000)], { env: envFor(s.url) });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), "✓ sent to personal (2 chunks)");
});

test("send --file --caption → success with basename and size", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-cli-"));
  const file = join(dir, "report.log");
  writeFileSync(file, Buffer.alloc(2048));

  const r = await run(["send", "--file", file, "--caption", "logs"], { env: envFor(s.url) });
  assert.equal(r.code, 0);
  assert.match(r.stdout.trim(), /^✓ sent report\.log \(0\.0 MB\) to personal$/);
});

test("--file with positional text → exit 2", async (t) => {
  const r = await run(["send", "--file", "/tmp/x", "extra"], { env: envFor() });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--caption/);
  assertCleanStderr(t, r.stderr);
});

test("--caption without --file → exit 2", async (t) => {
  const r = await run(["send", "--caption", "c", "text"], { env: envFor() });
  assert.equal(r.code, 2);
  assertCleanStderr(t, r.stderr);
});

test("unknown --to → exit 1 listing valid aliases", async (t) => {
  const r = await run(["send", "--to", "nope", "hi"], { env: envFor() });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Unknown channel "nope"/);
  assert.match(r.stderr, /personal/);
  assert.match(r.stderr, /^agent-tg: /);
  assertCleanStderr(t, r.stderr);
});

test("no config → exit 1 pointing at init", async (t) => {
  const r = await run(["send", "hi"], { env: envFor(null, { AGENT_TG_CONFIG: "/nonexistent/config.json" }) });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /agent-tg init/);
  assertCleanStderr(t, r.stderr);
});

test("empty piped stdin → exit 1 No message text given", async (t) => {
  const r = await run(["send"], { env: envFor(), input: "" });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /No message text given/);
  assertCleanStderr(t, r.stderr);
});

test("no --to and no default → exit 2", async (t) => {
  const cfgFile = writeFixtureConfig();
  const cfg = JSON.parse(readFileSync(cfgFile, "utf8"));
  delete cfg.default;
  writeFileSync(cfgFile, JSON.stringify(cfg));
  const r = await run(["send", "hi"], { env: envFor(null, { AGENT_TG_CONFIG: cfgFile }) });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--to/);
  assertCleanStderr(t, r.stderr);
});

test("channels --json → parseable, tokenSet, no token value", async (t) => {
  const r = await run(["channels", "--json"], { env: envFor() });
  assert.equal(r.code, 0);
  const list = JSON.parse(r.stdout);
  assert.deepEqual(list, [
    { id: "personal", bot: "main", chatId: "123", tokenEnv: "TG_BOT_MAIN", tokenSet: true },
  ]);
  assert.ok(!r.stdout.includes(TOKEN));
  assertCleanStderr(t, r.stderr);
});

test("channels table format", async (t) => {
  const r = await run(["channels"], { env: envFor() });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^personal  bot=main  chatId=123  token=TG_BOT_MAIN:set\n?$/);
});

test("send --rich → success line, one sendRichMessage request", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const r = await run(["send", "--rich", "--to", "personal", "**hello**"], { env: envFor(s.url) });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), "✓ sent rich to personal");
  assert.equal(s.requests.length, 1);
  assert.match(s.requests[0].url, /\/sendRichMessage$/);
  assert.deepEqual(s.requests[0].json, { chat_id: "123", rich_message: { markdown: "**hello**" } });
  assertCleanStderr(t, r.stderr);
});

test("send --rich --file → exit 2", async (t) => {
  const r = await run(["send", "--rich", "--file", "/tmp/x"], { env: envFor() });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--rich/);
  assertCleanStderr(t, r.stderr);
});

test("send --rich over 32768 chars → exit 1 mentioning the limit", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const r = await run(["send", "--rich", "x".repeat(32769)], { env: envFor(s.url) });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /32768/);
  assertCleanStderr(t, r.stderr);
});

test("--version prints core package version", async (t) => {
  const r = await run(["--version"]);
  assert.equal(r.code, 0);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(r.stdout.trim(), pkg.version);
});

test("unknown subcommand → exit 2", async (t) => {
  const r = await run(["explode"], { env: envFor() });
  assert.equal(r.code, 2);
  assertCleanStderr(t, r.stderr);
});

test("init --config-only writes config into fake HOME, no skill", async (t) => {
  const home = mkdtempSync(join(tmpdir(), "agent-tg-home-"));
  const env = { HOME: home }; // hermetic: no XDG_CONFIG_HOME/AGENT_TG_CONFIG inherited
  const r = await run(["init", "--config-only"], { env });
  assert.equal(r.code, 0);
  assert.ok(existsSync(join(home, ".config", "agent-tg", "config.json")));
  assert.ok(!existsSync(join(home, ".agents")));
  assert.match(r.stdout, /config/);
});

test("init --skill-only writes skill into fake HOME, no config", async (t) => {
  const home = mkdtempSync(join(tmpdir(), "agent-tg-home-"));
  const env = { HOME: home }; // hermetic: no XDG_CONFIG_HOME/AGENT_TG_CONFIG inherited
  const r = await run(["init", "--skill-only"], { env });
  assert.equal(r.code, 0);
  assert.ok(existsSync(join(home, ".agents", "skills", "agent-tg", "SKILL.md")));
  assert.ok(!existsSync(join(home, ".config")));
});
