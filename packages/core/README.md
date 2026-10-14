# agent-tg

Send Telegram messages and files from AI coding agents — multi-bot, multi-channel, zero dependencies.

`agent-tg` is a small CLI + library that lets any coding agent (OpenCode, Claude Code, or a plain shell) push text and files to Telegram channels by alias. Bots, channels and tokens live in one config file — never in the chat.

## Install

```sh
npm i -g agent-tg
agent-tg init          # creates the config scaffold + installs the universal skill
```

Then:

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy its token.
2. `export TG_BOT_MAIN="<token>"` (recommended) — inline `token` in the config also works but is discouraged.
3. Get your `chat_id`: message the bot, then open `https://api.telegram.org/bot<token>/getUpdates` (or ask [@userinfobot](https://t.me/userinfobot)).
4. Edit the config — set `chatId`, add channels and bots as you need.

## Config

`~/.config/agent-tg/config.json` (XDG; `%APPDATA%\agent-tg\config.json` on Windows; `AGENT_TG_CONFIG` overrides):

```json
{
  "default": "personal",
  "bots": {
    "main": { "tokenEnv": "TG_BOT_MAIN" },
    "ci": { "tokenEnv": "TG_CI_BOT" }
  },
  "channels": [
    { "id": "personal", "bot": "main", "chatId": "123456789" },
    { "id": "alerts", "bot": "ci", "chatId": "-1009876543210" }
  ]
}
```

Tokens resolve from `tokenEnv` at send time; inline `token` is allowed with a loud warning. One bot can serve many channels; many bots are supported.

## CLI

```sh
agent-tg send --to personal "deploy done"     # text (positional or piped via stdin)
agent-tg send --to personal --rich "**deploy done**"  # one rich-formatted message (≤ 32768 chars)
agent-tg send --to alerts --file build.log --caption "latest build"
agent-tg channels [--json]
agent-tg init [--config-only | --skill-only]
agent-tg --help | --version
```

Messages over 4096 characters are split into chunks automatically; files up to 50 MB are sent as documents. Rich markdown goes out as one message up to 32768 chars via `--rich` (and `sendRich` in the library). Exit codes: `0` success, `1` runtime failure, `2` usage error. Errors never print tokens or stack traces.

## Library

```js
import { sendText, sendRich } from "agent-tg";

const { chatId, chunks } = await sendText({ to: "personal", text: "hello" });

// One rich-formatted message, no chunking (rich markdown, ≤ 32768 chars):
const { messageId } = await sendRich({ to: "personal", markdown: "**hello**" });
```

Exports: `configPath, loadConfig, resolveChannel, channelList, sendText, sendFile, sendRich, chunkText, init, TgError` (typed via hand-written `index.d.ts`; errors carry stable `code`s like `NO_CONFIG`, `UNKNOWN_CHANNEL`, `RICH_TOO_LONG`, `API_ERROR`).

## Adapters

- **OpenCode**: [`opencode-tg`](https://www.npmjs.com/package/opencode-tg) plugin — registers a `telegram_send` tool.
- **Claude Code**: [`claude-code-tg`](https://www.npmjs.com/package/claude-code-tg) — delivers the skill through the plugin marketplace.

## Security notes

Tokens are read from the environment or the local config and appear only in the HTTPS request URL to `api.telegram.org`; error messages are built from response bodies and never contain tokens or URLs. No telemetry, no network calls except the Telegram Bot API.

MIT © 2026 NemeZZiZZ
