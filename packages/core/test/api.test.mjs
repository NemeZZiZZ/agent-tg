import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMessage, sendDocument, sendRichMessage } from "../src/api.mjs";
import { startServer } from "./helpers/server.mjs";

const TOKEN = "111:LEAKED-TOKEN-VALUE";

test("sendMessage happy path", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([{ status: 200, body: { ok: true, result: { message_id: 777 } } }]);

  const res = await sendMessage(
    { token: TOKEN, chatId: "123", text: "hi" },
    { apiBase: s.url, sleep: async () => {} },
  );
  assert.deepEqual(res, { messageId: 777 });
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].url, `/bot${TOKEN}/sendMessage`);
  assert.deepEqual(s.requests[0].json, { chat_id: "123", text: "hi" });
});

test("ok:false 400 → API_ERROR with description, no token leak", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([{ status: 400, body: { ok: false, error_code: 400, description: "Bad Request: chat not found" } }]);

  await assert.rejects(
    () => sendMessage({ token: TOKEN, chatId: "123", text: "hi" }, { apiBase: s.url }),
    (err) =>
      err.code === "API_ERROR" &&
      err.message.includes("Bad Request: chat not found") &&
      !err.message.includes(TOKEN) &&
      !err.message.includes(s.url),
  );
});

test("429 retries once after retry_after seconds", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([
    { status: 429, body: { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 7 } } },
    { status: 200, body: { ok: true, result: { message_id: 5 } } },
  ]);
  const sleeps = [];

  const res = await sendMessage(
    { token: TOKEN, chatId: "123", text: "hi" },
    { apiBase: s.url, sleep: async (ms) => sleeps.push(ms) },
  );
  assert.deepEqual(res, { messageId: 5 });
  assert.equal(s.requests.length, 2);
  assert.deepEqual(sleeps, [7000]);
});

test("429 twice → API_ERROR after two attempts", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const four29 = { status: 429, body: { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 1 } } };
  s.setResponses([four29, four29]);
  const sleeps = [];

  await assert.rejects(
    () => sendMessage({ token: TOKEN, chatId: "123", text: "hi" }, { apiBase: s.url, sleep: async (ms) => sleeps.push(ms) }),
    (err) => err.code === "API_ERROR",
  );
  assert.equal(s.requests.length, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("sendRichMessage happy path posts rich_message.markdown", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([{ status: 200, body: { ok: true, result: { message_id: 11 } } }]);

  const res = await sendRichMessage(
    { token: TOKEN, chatId: "123", markdown: "**hi**" },
    { apiBase: s.url, sleep: async () => {} },
  );
  assert.deepEqual(res, { messageId: 11 });
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].url, `/bot${TOKEN}/sendRichMessage`);
  assert.deepEqual(s.requests[0].json, { chat_id: "123", rich_message: { markdown: "**hi**" } });
});

test("sendRichMessage 429 retries once", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([
    { status: 429, body: { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 7 } } },
    { status: 200, body: { ok: true, result: { message_id: 12 } } },
  ]);
  const sleeps = [];

  const res = await sendRichMessage(
    { token: TOKEN, chatId: "123", markdown: "**hi**" },
    { apiBase: s.url, sleep: async (ms) => sleeps.push(ms) },
  );
  assert.deepEqual(res, { messageId: 12 });
  assert.equal(s.requests.length, 2);
  assert.deepEqual(sleeps, [7000]);
});

test("sendRichMessage ok:false → API_ERROR, no token leak", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([{ status: 400, body: { ok: false, error_code: 400, description: "Bad Request: rich too long" } }]);

  await assert.rejects(
    () => sendRichMessage({ token: TOKEN, chatId: "123", markdown: "**hi**" }, { apiBase: s.url }),
    (err) =>
      err.code === "API_ERROR" &&
      err.message.includes("Bad Request: rich too long") &&
      !err.message.includes(TOKEN) &&
      !err.message.includes(s.url),
  );
});

test("connection refused → API_ERROR with cause", async () => {
  await assert.rejects(
    () => sendMessage({ token: TOKEN, chatId: "123", text: "hi" }, { apiBase: "http://127.0.0.1:1" }),
    (err) =>
      err.code === "API_ERROR" &&
      /^Telegram request failed:/.test(err.message) &&
      err.cause !== undefined,
  );
});

test("sendDocument posts multipart with filename and caption", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  s.setResponses([{ status: 200, body: { ok: true, result: { message_id: 9 } } }]);

  const res = await sendDocument(
    { token: TOKEN, chatId: "123", file: Buffer.from("file-bytes"), filename: "report.txt", caption: "the report" },
    { apiBase: s.url },
  );
  assert.deepEqual(res, { messageId: 9 });
  assert.equal(s.requests[0].url, `/bot${TOKEN}/sendDocument`);
  assert.match(s.requests[0].headers["content-type"], /^multipart\/form-data/);

  const body = s.requests[0].rawBody.toString("latin1");
  assert.ok(body.includes("report.txt"));
  assert.ok(body.includes("the report"));
  assert.ok(body.includes("document"));
  assert.ok(body.includes("file-bytes"));
});

test("sendDocument omits caption when absent", async (t) => {
  const s = await startServer();
  t.after(() => s.close());

  await sendDocument(
    { token: TOKEN, chatId: "123", file: Buffer.from("x"), filename: "f.bin" },
    { apiBase: s.url },
  );
  const body = s.requests[0].rawBody.toString("latin1");
  assert.ok(!body.includes("caption"));
});
