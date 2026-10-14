import { TgError } from "./errors.mjs";

/**
 * Resolve a channel alias to everything needed to send: bot name, chatId, token.
 * Token precedence: inline `bot.token` (config) over `env[bot.tokenEnv]`.
 *
 * @param {{ default?: string, bots: Record<string, { tokenEnv?: string, token?: string }>, channels: Array<{ id: string, bot: string, chatId: string }> }} config
 * @param {string | undefined} alias
 * @param {{ env?: Record<string, string | undefined> }} [opts]
 * @returns {{ alias: string, bot: string, chatId: string, token: string }}
 */
export function resolveChannel(config, alias, opts = {}) {
  const env = opts.env ?? process.env;
  const id = alias ?? config.default;

  if (!id) {
    throw new TgError("no channel given and no default configured", "UNKNOWN_CHANNEL");
  }
  const channel = config.channels.find((c) => c.id === id);
  if (!channel) {
    const valid = config.channels.map((c) => c.id).join(", ");
    throw new TgError(`Unknown channel "${id}". Valid: ${valid}`, "UNKNOWN_CHANNEL");
  }
  const bot = config.bots[channel.bot];
  const token = bot.token ?? env[bot.tokenEnv];
  if (!token) {
    throw new TgError(
      `bot "${channel.bot}" (channel "${id}") has no token: set ${bot.tokenEnv} in the environment`,
      "MISSING_TOKEN",
    );
  }
  return { alias: id, bot: channel.bot, chatId: channel.chatId, token };
}

/**
 * List channels with token availability (for `agent-tg channels`).
 *
 * @param {{ bots: Record<string, { tokenEnv?: string, token?: string }>, channels: Array<{ id: string, bot: string, chatId: string }> }} config
 * @param {{ env?: Record<string, string | undefined> }} [opts]
 * @returns {Array<{ id: string, bot: string, chatId: string, tokenEnv: string | undefined, tokenSet: boolean }>}
 */
export function channelList(config, opts = {}) {
  const env = opts.env ?? process.env;
  return config.channels.map((ch) => {
    const bot = config.bots[ch.bot];
    return {
      id: ch.id,
      bot: ch.bot,
      chatId: ch.chatId,
      tokenEnv: bot.tokenEnv,
      tokenSet: Boolean(bot.token ?? env[bot.tokenEnv]),
    };
  });
}
