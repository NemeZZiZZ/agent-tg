# claude-code-tg

Send Telegram messages and files from Claude Code via the [agent-tg](https://www.npmjs.com/package/agent-tg) skill — multi-bot × multi-channel outbound, for when the official Anthropic telegram plugin isn't enough.

## Install

From a Claude Code session:

    /plugin install NemeZZiZZ/agent-tg

Then pick **claude-code-tg** from the marketplace.

Prerequisite: the skill shells out to the `agent-tg` CLI — installing the plugin does **not** put it on PATH. Install it once globally:

```sh
npm i -g agent-tg
agent-tg init
```

## Verify

1. `agent-tg channels` prints your configured channels (after you edit `~/.config/agent-tg/config.json`).
2. In Claude Code, ask: "Send 'hello' to my personal Telegram channel" — the agent should use the `agent-tg` skill and report `✓ sent to personal (1 chunk)`.

## What it delivers

A skill (`skills/agent-tg/SKILL.md`) that teaches the agent the `agent-tg` CLI: sending text (auto-chunked at 4096 chars), sending files up to 50 MB with captions, and listing channels. No hooks, no daemon — channels, bots and tokens stay in the local config, never in chat.

## Security

Tokens live in the environment (`tokenEnv`) or local config; errors never contain tokens. No telemetry.

MIT © 2026 NemeZZiZZ
