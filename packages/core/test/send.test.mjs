import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendText, sendFile, sendRich } from "../src/send.mjs";
import { startServer } from "./helpers/server.mjs";

const TOKEN = "111:LEAKED-TOKEN-VALUE";
const config = {
  default: "dev",
  bots: { main: { token: TOKEN } },
  channels: [{ id: "dev", bot: "main", chatId: "123" }],
};
const baseOpts = (s) => ({ config, apiBase: s.url, sleep: async () => {} });
const ok = (id) => ({ status: 200, body: { ok: true, result: { message_id: id } } });

test("sendText one chunk returns chatId and message ids", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([ok(777)]);

  const res = await sendText({ to: "dev", text: "hello" }, baseOpts(s));
  assert.deepEqual(res, { chatId: "123", chunks: [777] });
});

test("sendText 5000 chars → two requests, two ids", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([ok(1), ok(2)]);

  const res = await sendText({ to: "dev", text: "x".repeat(5000) }, baseOpts(s));
  assert.deepEqual(res.chunks, [1, 2]);
  assert.equal(s.requests.length, 2);
});

test("sendText partial failure reports chunk index and delivered count, no token", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([ok(1), { status: 400, body: { ok: false, error_code: 400, description: "Bad Request" } }]);

  await assert.rejects(
    () => sendText({ to: "dev", text: "x".repeat(5000) }, baseOpts(s)),
    (err) =>
      err.code === "API_ERROR" &&
      err.message.includes("chunk 2 of 2") &&
      err.message.includes("1 delivered") &&
      err.message.includes('"dev"') &&
      !err.message.includes(TOKEN),
  );
});

test("empty or whitespace text → MISSING_TEXT", async () => {
  for (const text of ["", "   \n\t"]) {
    await assert.rejects(
      () => sendText({ to: "dev", text }, { config }),
      (err) => err.code === "MISSING_TEXT" && err.message === "No message text given",
    );
  }
});

test("caption of exactly 1024 passes, 1025 → CAPTION_TOO_LONG", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-file-"));
  const file = join(dir, "a.txt");
  writeFileSync(file, "content");

  const res = await sendFile(
    { to: "dev", file, caption: "c".repeat(1024) },
    baseOpts(s),
  );
  assert.equal(res.messageId, 1);

  await assert.rejects(
    () => sendFile({ to: "dev", file, caption: "c".repeat(1025) }, baseOpts(s)),
    (err) => err.code === "CAPTION_TOO_LONG",
  );
});

test("missing file → FILE_NOT_FOUND with path", async () => {
  await assert.rejects(
    () => sendFile({ to: "dev", file: "/definitely/not/here.bin" }, { config }),
    (err) => err.code === "FILE_NOT_FOUND" && err.message.includes("/definitely/not/here.bin"),
  );
});

test("file over maxFileBytes → FILE_TOO_LARGE with both sizes; at-limit passes", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-file-"));
  const file = join(dir, "big.bin");
  writeFileSync(file, Buffer.alloc(100));

  await assert.rejects(
    () => sendFile({ to: "dev", file }, { ...baseOpts(s), maxFileBytes: 10 }),
    (err) =>
      err.code === "FILE_TOO_LARGE" &&
      err.message.includes("100") &&
      err.message.includes("10"),
  );

  const res = await sendFile({ to: "dev", file }, { ...baseOpts(s), maxFileBytes: 100 });
  assert.equal(res.messageId, 1);
});

test("sendRich happy path returns chatId and messageId", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([ok(42)]);

  const res = await sendRich({ to: "dev", markdown: "**hi**" }, baseOpts(s));
  assert.deepEqual(res, { chatId: "123", messageId: 42 });
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].url, `/bot${TOKEN}/sendRichMessage`);
  assert.deepEqual(s.requests[0].json, { chat_id: "123", rich_message: { markdown: "**hi**" } });
});

test("sendRich empty or whitespace markdown → MISSING_TEXT", async () => {
  for (const markdown of ["", "   \n\t"]) {
    await assert.rejects(
      () => sendRich({ to: "dev", markdown }, { config }),
      (err) => err.code === "MISSING_TEXT" && err.message === "No message text given",
    );
  }
});

test("sendRich at 32768 chars passes, 32769 → RICH_TOO_LONG", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([ok(1)]);

  const res = await sendRich({ to: "dev", markdown: "x".repeat(32768) }, baseOpts(s));
  assert.equal(res.messageId, 1);

  await assert.rejects(
    () => sendRich({ to: "dev", markdown: "x".repeat(32769) }, baseOpts(s)),
    (err) =>
      err.code === "RICH_TOO_LONG" &&
      err.message.includes("32768"),
  );
});

test("sendRich API failure mentions alias, no token", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([{ status: 400, body: { ok: false, error_code: 400, description: "Bad Request" } }]);

  await assert.rejects(
    () => sendRich({ to: "dev", markdown: "**hi**" }, baseOpts(s)),
    (err) =>
      err.code === "API_ERROR" &&
      err.message.includes('"dev"') &&
      !err.message.includes(TOKEN),
  );
});

test("sendFile returns chatId and messageId", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-file-"));
  const file = join(dir, "named.log");
  writeFileSync(file, "log");

  const res = await sendFile({ to: "dev", file, caption: "cap" }, baseOpts(s));
  assert.deepEqual(res, { chatId: "123", messageId: 1 });
  assert.ok(s.requests[0].rawBody.toString("latin1").includes("named.log"));
});
