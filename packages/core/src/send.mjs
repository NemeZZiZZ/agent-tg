import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig } from "./config.mjs";
import { resolveChannel } from "./channels.mjs";
import { chunkText } from "./chunk.mjs";
import { sendMessage, sendDocument, sendRichMessage } from "./api.mjs";
import { TgError } from "./errors.mjs";

/** Max rich-message size in characters (Bot API rich message limit). */
export const RICH_LIMIT = 32768;

async function resolve(args, opts) {
  const config = opts.config ?? (await loadConfig(opts));
  return { config, channel: resolveChannel(config, args.to, opts) };
}

/**
 * Send text to a channel: validates, chunks (>4096), sends chunks sequentially.
 * A failure mid-sequence reports which chunk failed and how many were delivered.
 *
 * @param {{ to?: string, text?: string }} args
 * @param {object} [opts] loadConfig/resolveChannel/sendMessage opts plus `config` (skip loading) and `maxFileBytes`
 * @returns {Promise<{ chatId: string, chunks: number[] }>}
 */
export async function sendText(args, opts = {}) {
  if (!args.text?.trim()) {
    throw new TgError("No message text given", "MISSING_TEXT");
  }
  const { channel } = await resolve(args, opts);

  const chunks = chunkText(args.text);
  const ids = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const res = await sendMessage({ token: channel.token, chatId: channel.chatId, text: chunks[i] }, opts);
      ids.push(res.messageId);
    } catch (err) {
      throw new TgError(
        `Failed to send chunk ${i + 1} of ${chunks.length} to "${channel.alias}" (${ids.length} delivered): ${err?.message}`,
        "API_ERROR",
      );
    }
  }
  return { chatId: channel.chatId, chunks: ids };
}

/**
 * Send one rich-formatted message to a channel (no chunking, ≤32768 chars).
 *
 * @param {{ to?: string, markdown?: string }} args
 * @param {object} [opts] loadConfig/resolveChannel/sendRichMessage opts plus `config` (skip loading)
 * @returns {Promise<{ chatId: string, messageId: number }>}
 */
export async function sendRich(args, opts = {}) {
  if (!args.markdown?.trim()) {
    throw new TgError("No message text given", "MISSING_TEXT");
  }
  if (args.markdown.length > RICH_LIMIT) {
    throw new TgError(
      `Rich message is ${args.markdown.length} characters, over the ${RICH_LIMIT} limit`, "RICH_TOO_LONG",
    );
  }

  const { channel } = await resolve(args, opts);
  try {
    const res = await sendRichMessage(
      { token: channel.token, chatId: channel.chatId, markdown: args.markdown },
      opts,
    );
    return { chatId: channel.chatId, messageId: res.messageId };
  } catch (err) {
    if (err instanceof TgError && err.code !== "API_ERROR") throw err;
    throw new TgError(`Failed to send rich message to "${channel.alias}": ${err?.message}`, "API_ERROR");
  }
}
/**
 * Send a file to a channel as a document (≤50 MB by default).
 *
 * @param {{ to?: string, file: string, caption?: string }} args
 * @param {object} [opts] loadConfig/resolveChannel/sendDocument opts plus `config` (skip loading), `maxFileBytes` (default 52428800)
 * @returns {Promise<{ chatId: string, messageId: number }>}
 */
export async function sendFile(args, opts = {}) {
  const maxFileBytes = opts.maxFileBytes ?? 52_428_800;

  let st;
  try {
    st = statSync(args.file);
  } catch {
    throw new TgError(`File not found: ${args.file}`, "FILE_NOT_FOUND");
  }
  if (st.size > maxFileBytes) {
    throw new TgError(
      `File is ${st.size} bytes, over the ${maxFileBytes} byte limit`, "FILE_TOO_LARGE",
    );
  }
  if (args.caption !== undefined && args.caption.length > 1024) {
    throw new TgError(`Caption is ${args.caption.length} characters, over the 1024 limit`, "CAPTION_TOO_LONG");
  }

  const { channel } = await resolve(args, opts);
  try {
    const res = await sendDocument(
      {
        token: channel.token,
        chatId: channel.chatId,
        file: readFileSync(args.file),
        filename: basename(args.file),
        caption: args.caption,
      },
      opts,
    );
    return { chatId: channel.chatId, messageId: res.messageId };
  } catch (err) {
    if (err instanceof TgError) throw err;
    throw new TgError(`Failed to send file to "${channel.alias}": ${err?.message}`, "API_ERROR");
  }
}
