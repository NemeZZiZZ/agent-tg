# agent-tg

Send Telegram messages and files from AI coding agents. One config, many bots, many channels — scheduled-task reports, CI alerts, or manual sends. Tokens stay in your environment and config, never in the model's context.

**Zero dependencies. Node 18+. No daemon, no SaaS, no webhooks.**

## Why

Coding agents that finish long tasks (scheduled runs, big refactors, CI pipelines) need to report back. Copy-pasting a bot token into a `curl` command puts a secret in the model's context; SaaS notification routers put your messages on someone else's server. `agent-tg` is the boring alternative: a local config maps channel aliases to bot+chat, and every agent on your machine — OpenCode, Claude Code, a shell script — sends through it.

Multi-bot × multi-channel: one config, N bots, M channels, any bot per channel. The OpenCode tool schema even presents your aliases as an enum, so the model can't typo a channel name.

## Positioning

| | [dukaev/agent-telegram](https://github.com/dukaev/agent-telegram) | [lifening/opencode-telegram](https://github.com/lifening/opencode-telegram) | official Anthropic `telegram` plugin | **agent-tg** |
|---|---|---|---|---|
| Multi-bot config | ✗ | ✗ | ✗ | ✓ |
| Multi-channel aliases | ✗ | ✗ | ✗ | ✓ (enum in tool schema) |
| Cross-agent (CLI + skill) | ✗ | ✗ | ✗ | ✓ OpenCode + Claude Code + any shell |
| Zero deps / no build | ✓ | partial | ✓ | ✓ plain ESM, Node 18+ |
| Daemon / SaaS | none | none | none | none |

Landscape in one paragraph: userbot clients (agent-messenger, avemeva) are full Telegram clients — not our league; curl+env snippets (headlong, seedprod, …) hardcode a token per command; the-factory aliases chats but ships one bot, not a package; SaaS wrappers (zavu, composio) route your messages through their servers — the anti-pattern we exist to avoid; n8n-style bot builders are a different product category entirely. The niche — multi-bot × multi-channel × cross-agent × zero-deps, no daemon — was unoccupied.

## Packages

| Package | What it is |
|---|---|
| [`agent-tg`](./packages/core) | CLI + library. `npm i -g agent-tg` |
| [`opencode-tg`](./packages/opencode) | OpenCode plugin: `telegram_send` tool with alias enum |
| [`claude-code-tg`](./packages/claude-code) | Claude Code plugin: skill delivery via marketplace |
| universal skill | `agent-tg init` installs `SKILL.md` into `~/.agents/skills/agent-tg` |

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) → copy the token.
2. Put the token in the environment (recommended):

   ```sh
   export TG_BOT_MAIN="123456:ABC-DEF…"        # sh/bash/zsh
   ```

   Windows: `setx TG_BOT_MAIN "123456:ABC-DEF…"` (new terminals) or
   `[Environment]::SetEnvironmentVariable("TG_BOT_MAIN", "…", "User")` (PowerShell, permanent).

3. `npm i -g agent-tg`
4. `agent-tg init` — creates the config scaffold and installs the universal skill.
5. Get your `chat_id`: send the bot any message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` (or ask [@userinfobot](https://t.me/userinfobot)). For a group/channel, add the bot there and use the negative id.
6. Edit the config (below), then:

   ```sh
   agent-tg send "first report ✓"
   ```

## Config

`~/.config/agent-tg/config.json` (XDG; `%APPDATA%\agent-tg\config.json` on Windows; `AGENT_TG_CONFIG` env var overrides):

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

- `bots.<name>.tokenEnv` — environment variable read at send time. **Recommended.**
- `bots.<name>.token` — inline token. Allowed, but `agent-tg` prints a loud warning on every run: a config file is a worse place for secrets than the environment.
- `channels[].id` — alias used everywhere (`--to`, tool enum). Must be unique.
- `default` — alias used when `--to` is omitted.

## CLI

```
agent-tg send [--to <alias>] [text]           # text positional or piped via stdin
agent-tg send [--to <alias>] --rich [text]      # one rich-formatted message (rich markdown, ≤ 32768 chars)
agent-tg send [--to <alias>] --file <path> [--caption <text>]
agent-tg channels [--json]
agent-tg init [--config-only | --skill-only]
agent-tg --help | --version
```

- Text over 4096 chars is split into chunks automatically; files up to 50 MB are sent as documents (caption ≤ 1024 chars). Rich markdown goes out as one message up to 32768 chars via `--rich`.
- Exit codes: `0` success · `1` runtime failure (config, token, Telegram API — message on stderr) · `2` usage error.
- Errors are one plain line — `agent-tg: <reason>` — never a stack trace, never a token, never a URL.

## Threat model

- A leaked bot token lets the holder send **as that bot only** (and read its updates). Revoke via @BotFather → `/revoke`; rotate per-channel by splitting bots.
- `chat_id` is not a secret: knowing it doesn't let anyone send *to* you without the bot token.
- The config file contains channel ids (and inline tokens if you insist). `tokenEnv` keeps secrets in the environment; nothing agent-tg prints includes a token.
- agent-tg makes exactly one kind of network call: HTTPS to `api.telegram.org`. No telemetry.

MIT © 2026 NemeZZiZZ
