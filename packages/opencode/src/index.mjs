import process from "node:process";
import { loadConfig, sendText, sendFile, sendRich } from "agent-tg";

const DESCRIPTION = "Send a Telegram message or file to a configured channel (multi-bot, multi-channel via agent-tg config)";

/**
 * OpenCode V2 plugin: registers the `telegram_send` tool backed by agent-tg.
 * Plain object on purpose — V2 reads `id` + `setup`; no SDK import needed.
 */
export default {
  id: "telegram",

  async setup(ctx) {
    const options = ctx.options ?? {};

    // Best-effort config read at registration time: powers the `to` enum.
    // When it fails (no config yet) the tool still registers, without enum.
    let config;
    try {
      config = await loadConfig();
    } catch {
      config = undefined;
    }
    const aliases = config?.channels.map((c) => c.id) ?? [];
    const fallback = options.default ?? config?.default;

    const toSchema = aliases.length > 0
      ? { type: "string", enum: aliases, description: "Channel alias (omit for default)" }
      : { type: "string", description: "Channel alias" };

    try {
      await ctx.tool.transform((editor) => {
        editor.namespace({ name: "telegram", description: "Telegram messaging via agent-tg" });
        editor.add({
          name: "send",
          description: DESCRIPTION,
          input: {
            type: "object",
            properties: {
              to: toSchema,
              text: { type: "string", description: "Message text (split into 4096-char chunks automatically)" },
              rich: { type: "boolean", description: "Send text as one rich-formatted message (rich markdown, ≤ 32768 chars, requires text)" },
              file: { type: "string", description: "Absolute path to a file to send (≤ 50 MB)" },
              caption: { type: "string", description: "Caption for the file (≤ 1024 chars, requires file)" },
            },
            required: [],
            additionalProperties: false,
          },
          options: { namespace: "telegram" },
          async execute(input, context) {
            let cfg;
            try {
              cfg = await loadConfig();
            } catch (err) {
              throw new Error(err.message); // e.g. "no config … run `agent-tg init`" — reaches the model
            }

            if (input.text && input.file) throw new Error("provide either text or file, not both");
            if (!input.text && !input.file) throw new Error("provide text or file");
            if (input.caption && !input.file) throw new Error("caption requires file");
            if (input.rich && !input.text) throw new Error("rich requires text, not file");

            const alias = input.to ?? options.default ?? cfg.default;
            await context.progress({ status: `sending to ${alias ?? "channel"}` });

            const opts = { config: cfg, env: process.env, signal: context?.signal };
            try {
              if (input.file) {
                const res = await sendFile({ to: alias, file: input.file, caption: input.caption }, opts);
                const base = String(input.file).split("/").pop();
                return { content: `✓ sent ${base} to ${alias ?? res.chatId}` };
              }
              if (input.rich) {
                await sendRich({ to: alias, markdown: input.text }, opts);
                return { content: `✓ sent rich to ${alias}` };
              }
              const res = await sendText({ to: alias, text: input.text }, opts);
              const n = res.chunks.length;
              return { content: `✓ sent to ${alias ?? res.chatId} (${n} chunk${n === 1 ? "" : "s"})` };
            } catch (err) {
              throw new Error(err.message);
            }
          },
        });
      });
    } catch (err) {
      // A plugin must never break the session.
      console.error(`opencode-tg: tool registration failed: ${err?.message}`);
    }
  },
};
