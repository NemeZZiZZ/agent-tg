#!/usr/bin/env node
import { parseArgs } from "node:util";
import process from "node:process";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { sendText, sendFile, sendRich } from "../src/send.mjs";
import { loadConfig } from "../src/config.mjs";
import { channelList } from "../src/channels.mjs";
import { init } from "../src/init.mjs";
import { TgError } from "../src/errors.mjs";

const USAGE = `agent-tg — send Telegram messages and files from AI coding agents

Usage:
  agent-tg send [--to <alias>] [text]
  agent-tg send [--to <alias>] --rich [text]
  agent-tg send [--to <alias>] --file <path> [--caption <text>]
  agent-tg channels [--json]
  agent-tg init [--config-only | --skill-only]
  agent-tg --help | --version

Text is read from stdin when piped and no positional text is given.
Config: ~/.config/agent-tg/config.json (AGENT_TG_CONFIG overrides).
Run \`agent-tg init\` to create a config and install the skill.`;

function usageError(message) {
  process.stderr.write(`agent-tg: ${message}\nRun \`agent-tg --help\` for usage.\n`);
  process.exit(2);
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function cmdSend(rest) {
  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        to: { type: "string" },
        file: { type: "string" },
        caption: { type: "string" },
        rich: { type: "boolean" },
      },
    });
  } catch (err) {
    usageError(err.message);
  }
  const { to, file, caption, rich = false } = parsed.values;
  const positionals = parsed.positionals;

  if (file && positionals.length > 0) {
    usageError("positional text cannot be combined with --file — use --caption instead");
  }
  if (caption !== undefined && !file) usageError("--caption requires --file");
  if (rich && file) usageError("--rich requires text, not --file");

  const config = await loadConfig({ env: process.env });
  const alias = to ?? config.default;
  if (!alias) usageError("no --to given and no default channel configured");

  const common = { config, env: process.env, signal: AbortSignal.timeout(120_000) };

  if (file) {
    const res = await sendFile({ to: alias, file, caption }, common);
    const size = statSync(file).size;
    const mb = (size / (1024 * 1024)).toFixed(1);
    process.stdout.write(`✓ sent ${basename(file)} (${mb} MB) to ${res.chatId === undefined ? alias : alias}\n`);
    return;
  }

  let text = positionals.join(" ");
  if (!text && !process.stdin.isTTY) text = await readStdin();
  if (!text?.trim()) throw new TgError("No message text given", "MISSING_TEXT");

  if (rich) {
    await sendRich({ to: alias, markdown: text }, common);
    process.stdout.write(`✓ sent rich to ${alias}\n`);
    return;
  }

  const res = await sendText({ to: alias, text }, common);
  process.stdout.write(`✓ sent to ${alias} (${res.chunks.length} chunk${res.chunks.length === 1 ? "" : "s"})\n`);
}

async function cmdChannels(rest) {
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: { json: { type: "boolean" } } });
  } catch (err) {
    usageError(err.message);
  }
  const list = channelList(await loadConfig({ env: process.env }), { env: process.env });
  if (parsed.values.json) {
    process.stdout.write(`${JSON.stringify(list, null, 2)}\n`);
    return;
  }
  for (const ch of list) {
    const source = ch.tokenEnv ?? "inline";
    process.stdout.write(`${ch.id}  bot=${ch.bot}  chatId=${ch.chatId}  token=${source}:${ch.tokenSet ? "set" : "unset"}\n`);
  }
}

async function cmdInit(rest) {
  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      options: {
        "config-only": { type: "boolean" },
        "skill-only": { type: "boolean" },
      },
    });
  } catch (err) {
    usageError(err.message);
  }
  const { "config-only": configOnly = false, "skill-only": skillOnly = false } = parsed.values;

  const res = init({ env: process.env, configOnly, skillOnly });
  if (!skillOnly) {
    process.stdout.write(res.configCreated ? `✓ config created at ${res.configPath}\n` : `• config already exists at ${res.configPath}\n`);
  }
  if (!configOnly) {
    process.stdout.write(`✓ skill installed at ${res.skillPath}\n`);
  }
  process.stdout.write(`Next steps:
  1. Create a bot with @BotFather and copy its token
  2. export TG_BOT_MAIN="<token>"
  3. Get your chat_id: message the bot, then open
     https://api.telegram.org/bot<token>/getUpdates (or ask @userinfobot)
  4. Edit ${res.configPath} — set chatId, add channels and bots
`);
}

function version() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  process.stdout.write(`${pkg.version}\n`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === "--version" || cmd === "-v") return version();
  if (cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (cmd === "send") return cmdSend(rest);
  if (cmd === "channels") return cmdChannels(rest);
  if (cmd === "init") return cmdInit(rest);

  usageError(cmd ? `unknown subcommand "${cmd}"` : "no subcommand given");
}

main().catch((err) => {
  process.stderr.write(`agent-tg: ${err?.message ?? err}\n`);
  process.exit(1);
});
