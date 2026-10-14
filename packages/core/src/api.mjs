import { setTimeout as sleepTimer } from "node:timers/promises";
import { TgError } from "./errors.mjs";

function defaults(opts = {}) {
  const env = opts.env ?? process.env;
  return {
    env,
    fetch: opts.fetch ?? globalThis.fetch,
    apiBase: opts.apiBase ?? env.AGENT_TG_API_BASE ?? "https://api.telegram.org",
    signal: opts.signal,
    sleep: opts.sleep ?? ((ms) => sleepTimer(ms, undefined, { signal: opts.signal })),
  };
}

/**
 * One attempt: POST and interpret the response.
 * Returns { result } on success, { retryAfter } on 429, throws TgError otherwise.
 * Error messages are built from the response body only — never the URL or token.
 */
async function attempt(url, buildInit, o) {
  let res;
  try {
    res = await o.fetch(url, { ...buildInit(), signal: o.signal });
  } catch (err) {
    const wrapped = new TgError(`Telegram request failed: ${err?.message ?? err}`, "API_ERROR");
    wrapped.cause = err;
    throw wrapped;
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new TgError(`Telegram API error (HTTP ${res.status}): response is not JSON`, "API_ERROR");
  }

  if (body?.ok === true) return { result: { messageId: body.result?.message_id } };
  if (body?.ok === false && body.error_code === 429) {
    return { retryAfter: body.parameters?.retry_after ?? 1 };
  }
  const code = body?.ok === false ? body.error_code : `HTTP ${res.status}`;
  const description = body?.description ?? "unknown error";
  throw new TgError(`Telegram API error (${code}): ${description}`, "API_ERROR");
}

/** Attempt, retry once on 429 after sleeping retry_after seconds. */
async function call(url, buildInit, o) {
  const first = await attempt(url, buildInit, o);
  if (!first.retryAfter) return first.result;
  await o.sleep(first.retryAfter * 1000);
  const second = await attempt(url, buildInit, o);
  if (second.retryAfter) {
    throw new TgError("Telegram API error (429): still rate-limited after one retry", "API_ERROR");
  }
  return second.result;
}

/**
 * Send a text message via the Bot API `sendMessage`.
 *
 * @param {{ token: string, chatId: string, text: string }} args
 * @param {{ env?: Record<string,string|undefined>, fetch?: typeof fetch, apiBase?: string, signal?: AbortSignal, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<{ messageId: number }>}
 */
export function sendMessage(args, opts = {}) {
  const o = defaults(opts);
  return call(
    `${o.apiBase}/bot${args.token}/sendMessage`,
    () => ({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: args.chatId, text: args.text }),
    }),
    o,
  );
}

/**
 * Send a file via the Bot API `sendDocument` (multipart).
 *
 * @param {{ token: string, chatId: string, file: Buffer, filename: string, caption?: string }} args
 * @param {{ env?: Record<string,string|undefined>, fetch?: typeof fetch, apiBase?: string, signal?: AbortSignal, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<{ messageId: number }>}
 */
export function sendDocument(args, opts = {}) {
  const o = defaults(opts);
  return call(
    `${o.apiBase}/bot${args.token}/sendDocument`,
    () => {
      const form = new FormData();
      form.set("chat_id", args.chatId);
      if (args.caption !== undefined) form.set("caption", args.caption);
      form.set("document", new Blob([args.file]), args.filename);
      return { method: "POST", body: form };
    },
    o,
  );
}

/**
 * Send a rich-formatted message via the Bot API `sendRichMessage` (Bot API 10.3+).
 * Markdown only: the caller passes rich-markdown source, no chunking is applied.
 *
 * @param {{ token: string, chatId: string, markdown: string }} args
 * @param {{ env?: Record<string,string|undefined>, fetch?: typeof fetch, apiBase?: string, signal?: AbortSignal, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<{ messageId: number }>}
 */
export function sendRichMessage(args, opts = {}) {
  const o = defaults(opts);
  return call(
    `${o.apiBase}/bot${args.token}/sendRichMessage`,
    () => ({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: args.chatId, rich_message: { markdown: args.markdown } }),
    }),
    o,
  );
}
