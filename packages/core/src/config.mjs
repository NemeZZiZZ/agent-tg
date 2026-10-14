import { readFileSync } from "node:fs";
import { configPath } from "./paths.mjs";
import { TgError } from "./errors.mjs";

/**
 * Load and validate the agent-tg config. Throws TgError(NO_CONFIG) when the
 * file is missing (message points at `agent-tg init`) and TgError(CONFIG_INVALID)
 * with a reason-stating message for every shape violation.
 *
 * @param {{ configPath?: string, env?: Record<string,string|undefined>, platform?: string, home?: string, warn?: (m: string) => void }} [opts]
 * @returns {Promise<{ default?: string, bots: Record<string, { tokenEnv?: string, token?: string }>, channels: Array<{ id: string, bot: string, chatId: string }> }>}
 */
export async function loadConfig(opts = {}) {
  const file = opts.configPath ?? configPath(opts);
  const warn = opts.warn ?? console.error;

  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw new TgError(`no config at ${file} — run \`agent-tg init\` to create one`, "NO_CONFIG");
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Never embed V8's parse message: it quotes file content, which can
    // carry an inline token (e.g. a token pasted as the whole file).
    throw new TgError(`config at ${file} is not valid JSON`, "CONFIG_INVALID");
  }

  const invalid = (reason) => new TgError(`config at ${file} is invalid: ${reason}`, "CONFIG_INVALID");

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw invalid("top level must be an object");
  }
  const { bots, channels } = parsed;

  if (typeof bots !== "object" || bots === null || Array.isArray(bots) || Object.keys(bots).length === 0) {
    throw invalid('"bots" must be a non-empty object');
  }
  if (!Array.isArray(channels) || channels.length === 0) {
    throw invalid('"channels" must be a non-empty array');
  }

  const seen = new Set();
  for (const ch of channels) {
    if (typeof ch?.id !== "string" || ch.id.length === 0) throw invalid("every channel needs a non-empty string id");
    if (seen.has(ch.id)) throw invalid(`channel ids must be unique, "${ch.id}" repeats`);
    seen.add(ch.id);
    if (!(ch.bot in bots)) throw invalid(`channel "${ch.id}" references unknown bot "${ch.bot}"`);
    if (typeof ch.chatId !== "string" || ch.chatId.length === 0) {
      throw invalid(`channel "${ch.id}" needs a non-empty string chatId`);
    }
  }

  if (parsed.default !== undefined && !seen.has(parsed.default)) {
    throw invalid(`"default" (${parsed.default}) matches no channel id`);
  }

  for (const [id, bot] of Object.entries(bots)) {
    if (!bot?.tokenEnv && !bot?.token) {
      throw invalid(`bot "${id}" needs tokenEnv or token`);
    }
    if (bot?.token) {
      warn(`agent-tg: bot "${id}" uses an inline token in ${file} — prefer tokenEnv`);
    }
  }

  return parsed;
}
